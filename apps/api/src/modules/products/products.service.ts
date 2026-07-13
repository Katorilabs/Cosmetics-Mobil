import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import { ListProductsQuery } from './dto/list-products.query.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListProductsQuery) {
    const where: Prisma.ProductWhereInput = {
      status: 'PUBLISHED',
      categoryId: query.categoryId,
      brandId: query.brandId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { brand: { name: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ name: 'asc' }],
        select: {
          id: true,
          slug: true,
          name: true,
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, slug: true } },
          variants: {
            where: { isActive: true },
            take: 1,
            select: {
              id: true,
              name: true,
              images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } },
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
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

  async getById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, status: 'PUBLISHED' },
      include: {
        brand: true,
        category: true,
        variants: {
          where: { isActive: true },
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
            formulas: {
              where: { isActive: true },
              take: 1,
              include: {
                ingredients: {
                  orderBy: { position: 'asc' },
                  include: { ingredient: true },
                },
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }
}
