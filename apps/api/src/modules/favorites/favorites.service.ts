import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { ListFavoritesQuery } from './dto/list-favorites.query.js';

const favoriteSelection = {
  id: true,
  createdAt: true,
  variant: {
    select: {
      id: true,
      name: true,
      sizeValue: true,
      sizeUnit: true,
      images: {
        take: 1,
        orderBy: { sortOrder: 'asc' as const },
        select: { url: true, altText: true },
      },
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          brand: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListFavoritesQuery) {
    const where = {
      userId,
      variant: { isActive: true, product: { status: 'PUBLISHED' as const } },
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.favorite.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: favoriteSelection,
      }),
      this.prisma.favorite.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pageCount: Math.ceil(total / query.limit),
      },
    };
  }

  async add(userId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        isActive: true,
        product: { status: 'PUBLISHED' },
      },
      select: { id: true },
    });

    if (!variant) {
      throw new NotFoundException({
        code: 'PRODUCT_VARIANT_NOT_FOUND',
        message: 'Published product variant not found',
      });
    }

    return this.prisma.favorite.upsert({
      where: { userId_variantId: { userId, variantId } },
      update: {},
      create: { userId, variantId },
      select: favoriteSelection,
    });
  }

  async remove(userId: string, variantId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, variantId } });
  }
}
