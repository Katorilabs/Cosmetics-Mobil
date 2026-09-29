import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import { ReportState, type AdminReviewsQuery, type ListReportsQuery, type ModerateReviewDto } from './dto/reviews.dto.js';
import { reviewConflict, reviewNotFound } from './reviews.service.js';

@Injectable()
export class ReviewsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminReviewsQuery) {
    const where = { status: query.status, variantId: query.variantId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where, skip: (query.page - 1) * query.limit, take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.review.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { data, meta: { page: query.page, limit: query.limit, total, pageCount: Math.ceil(total / query.limit) } };
  }

  async moderate(id: string, input: ModerateReviewDto) {
    try {
      return await this.prisma.review.update({
        where: { id, revision: input.revision },
        data: { status: input.status, revision: { increment: 1 } },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2025') throw error;
      const exists = await this.prisma.review.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw reviewNotFound();
      throw reviewConflict();
    }
  }

  async reports(query: ListReportsQuery) {
    const where = { resolvedAt: query.state === ReportState.OPEN ? null : { not: null } };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.reviewReport.findMany({
        where, skip: (query.page - 1) * query.limit, take: query.limit,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { review: true },
      }),
      this.prisma.reviewReport.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { data, meta: { page: query.page, limit: query.limit, total, pageCount: Math.ceil(total / query.limit) } };
  }

  async resolveReport(id: string): Promise<void> {
    // Resolution does not publish or reject a review; moderation is an explicit separate operation.
    await this.prisma.reviewReport.updateMany({ where: { id, resolvedAt: null }, data: { resolvedAt: new Date() } });
  }
}
