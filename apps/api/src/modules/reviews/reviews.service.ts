import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import type { ReplaceReviewDto, ReportReviewDto, ReviewPageQuery, WriteReviewDto } from './dto/reviews.dto.js';

const publicReview = {
  id: true, variantId: true, rating: true, title: true, body: true,
  revision: true, createdAt: true, updatedAt: true,
} as const;
const ownReview = { ...publicReview, status: true, profileSnapshot: true } as const;
const visibleVariant = { isActive: true, product: { status: 'PUBLISHED' as const } };

export function reviewNotFound() {
  return new NotFoundException({ code: 'REVIEW_NOT_FOUND', message: 'Review not found' });
}

export function reviewConflict() {
  return new ConflictException({ code: 'REVIEW_REVISION_CONFLICT', message: 'Review changed; reload before editing or moderating' });
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService, private readonly profiles: ProfilesService) {}

  async listMine(userId: string, query: ReviewPageQuery) {
    const where = { userId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where, select: ownReview, skip: (query.page - 1) * query.limit, take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.review.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return this.page(data, total, query);
  }

  async create(userId: string, variantId: string, input: WriteReviewDto) {
    await this.requireVariant(variantId);
    const profile = await this.profiles.get(userId);
    try {
      return await this.prisma.review.create({
        data: {
          userId, variantId, ...this.content(input), status: 'PENDING',
          profileSnapshot: {
            version: 1, skinType: profile.skinType, concerns: [...profile.concerns].sort(),
          },
        },
        select: ownReview,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'REVIEW_ALREADY_EXISTS', message: 'A review already exists for this variant' });
      }
      throw error;
    }
  }

  async replace(userId: string, variantId: string, input: ReplaceReviewDto) {
    await this.requireVariant(variantId);
    try {
      // Keep the original profile snapshot; every content edit requires renewed moderation.
      return await this.prisma.review.update({
        where: { userId_variantId: { userId, variantId }, revision: input.revision },
        data: { ...this.content(input), status: 'PENDING', revision: { increment: 1 } },
        select: ownReview,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2025') throw error;
      const exists = await this.prisma.review.findUnique({ where: { userId_variantId: { userId, variantId } }, select: { id: true } });
      if (!exists) throw reviewNotFound();
      throw reviewConflict();
    }
  }

  async remove(userId: string, variantId: string) {
    await this.prisma.review.deleteMany({ where: { userId, variantId } });
  }

  async listPublic(variantId: string, query: ReviewPageQuery) {
    await this.requireVariant(variantId);
    const where: Prisma.ReviewWhereInput = { variantId, status: 'PUBLISHED', variant: visibleVariant };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where, select: publicReview, skip: (query.page - 1) * query.limit, take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.review.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { ...this.page(data, total, query), textFormat: 'PLAIN_TEXT' };
  }

  async statistics(variantId: string, userId?: string) {
    await this.requireVariant(variantId);
    const profile = userId ? await this.profiles.get(userId) : null;
    const where: Prisma.ReviewWhereInput = {
      variantId, status: 'PUBLISHED', variant: visibleVariant,
      ...(profile ? {
        AND: [
          { profileSnapshot: { path: ['skinType'], equals: profile.skinType } },
          ...(profile.concerns.length ? [{
            OR: profile.concerns.map((concern) => ({
              profileSnapshot: { path: ['concerns'], array_contains: [concern] },
            })),
          }] : []),
        ],
      } : {}),
    };
    // Group in PostgreSQL; do not load review text or personal profile data for aggregates.
    const groups = await this.prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true } });
    const count = groups.reduce((sum, group) => sum + group._count._all, 0);
    const minimumSampleSize = profile ? 3 : 1;
    const sufficientData = count >= minimumSampleSize;
    return {
      variantId,
      basis: profile ? 'SAME_SKIN_TYPE_AND_ANY_SHARED_CONCERN' : 'ALL_PUBLISHED_REVIEWS',
      profile: profile ? { skinType: profile.skinType, concerns: profile.concerns, concernMatchRequired: profile.concerns.length > 0 } : null,
      count, minimumSampleSize, sufficientData,
      averageRating: sufficientData
        ? Math.round(groups.reduce((sum, group) => sum + group.rating * group._count._all, 0) / count * 100) / 100
        : null,
      distribution: sufficientData ? [1, 2, 3, 4, 5].map((rating) => ({
        rating, count: groups.find((group) => group.rating === rating)?._count._all ?? 0,
      })) : null,
      guidance: { basis: 'SELF_REPORTED_EXPERIENCE', medicalAdvice: false, affectsIngredientScore: false },
    };
  }

  async report(userId: string, reviewId: string, input: ReportReviewDto) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, status: 'PUBLISHED', variant: visibleVariant },
      select: { revision: true },
    });
    if (!review) throw reviewNotFound();
    if (review.revision !== input.revision) throw reviewConflict();
    return this.prisma.reviewReport.upsert({
      where: { userId_reviewId_reviewRevision: { userId, reviewId, reviewRevision: input.revision } },
      create: { userId, reviewId, reviewRevision: input.revision, reason: input.reason },
      update: {},
      select: { id: true, reviewId: true, reviewRevision: true, reason: true, createdAt: true, resolvedAt: true },
    });
  }

  private async requireVariant(id: string) {
    const variant = await this.prisma.productVariant.findFirst({ where: { id, ...visibleVariant }, select: { id: true } });
    if (!variant) throw new NotFoundException({ code: 'PRODUCT_VARIANT_NOT_FOUND', message: 'Published product variant not found' });
  }

  private content(input: WriteReviewDto) {
    return { rating: input.rating, title: input.title ?? null, body: input.body ?? null };
  }

  private page<T>(data: T[], total: number, query: ReviewPageQuery) {
    return { data, meta: { page: query.page, limit: query.limit, total, pageCount: Math.ceil(total / query.limit) } };
  }
}
