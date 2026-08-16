import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateIngredientAliasDto } from './dto/create-ingredient-alias.dto.js';
import type { ListIngredientsQuery } from './dto/list-ingredients.query.js';
import { normalizeIngredientName } from './ingredient-normalization.service.js';

@Injectable()
export class IngredientAliasesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListIngredientsQuery) {
    const where = query.search
      ? {
          OR: [
            { inciName: { contains: query.search, mode: 'insensitive' as const } },
            { aliases: { some: { alias: { contains: query.search, mode: 'insensitive' as const } } } },
          ],
        }
      : {};
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.ingredient.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { inciName: 'asc' },
        include: { aliases: { orderBy: { alias: 'asc' } } },
      }),
      this.prisma.ingredient.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pageCount: Math.ceil(total / query.limit),
      },
    };
  }

  async create(ingredientId: string, input: CreateIngredientAliasDto) {
    const alias = input.alias.trim().replace(/\s+/g, ' ');
    const normalizedAlias = normalizeIngredientName(alias);
    const [ingredient, canonicalCollision, aliasCollision] = await Promise.all([
      this.prisma.ingredient.findUnique({ where: { id: ingredientId }, select: { id: true } }),
      this.prisma.ingredient.findUnique({ where: { normalizedName: normalizedAlias }, select: { id: true } }),
      this.prisma.ingredientAlias.findUnique({ where: { normalizedAlias }, select: { id: true } }),
    ]);

    if (!ingredient) {
      throw new NotFoundException({
        code: 'INGREDIENT_NOT_FOUND',
        message: 'Ingredient not found',
      });
    }
    if (canonicalCollision || aliasCollision) {
      throw new ConflictException({
        code: 'INGREDIENT_ALIAS_CONFLICT',
        message: 'Alias already belongs to a canonical ingredient or alias',
      });
    }

    return this.prisma.ingredientAlias.create({
      data: {
        ingredientId,
        alias,
        normalizedAlias,
        sourceName: input.sourceName?.trim(),
        reviewedAt: new Date(),
      },
    });
  }

  async remove(aliasId: string): Promise<void> {
    const result = await this.prisma.ingredientAlias.deleteMany({ where: { id: aliasId } });

    if (result.count === 0) {
      throw new NotFoundException({
        code: 'INGREDIENT_ALIAS_NOT_FOUND',
        message: 'Ingredient alias not found',
      });
    }
  }
}
