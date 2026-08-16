import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { slugify } from '../../common/slugify.js';
import { PrismaService } from '../../database/prisma.service.js';

type IngredientDatabase = Pick<Prisma.TransactionClient, 'ingredient' | 'ingredientAlias'>;

export type IngredientInput = {
  inciName: string;
  commonNames?: string[];
  functions?: string[];
  description?: string;
};

export function normalizeIngredientName(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[‐‑‒–—―]/g, '-')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('en-US');
}

@Injectable()
export class IngredientNormalizationService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveOrCreateMany(database: IngredientDatabase, inputs: IngredientInput[]) {
    const cache = new Map<string, Awaited<ReturnType<typeof this.resolveOrCreate>>>();
    const resolved = [];

    for (const input of inputs) {
      const key = normalizeIngredientName(input.inciName);
      let ingredient = cache.get(key);

      if (!ingredient) {
        ingredient = await this.resolveOrCreate(database, input);
        cache.set(key, ingredient);
      }
      resolved.push(ingredient);
    }

    return resolved;
  }

  async resolvePreferenceNames(values: string[]): Promise<string[]> {
    const keys = [...new Set(values.map(normalizeIngredientName).filter(Boolean))];

    if (keys.length === 0) return [];

    const [ingredients, aliases] = await Promise.all([
      this.prisma.ingredient.findMany({
        where: { normalizedName: { in: keys } },
        select: { normalizedName: true, inciName: true },
      }),
      this.prisma.ingredientAlias.findMany({
        where: { normalizedAlias: { in: keys } },
        select: { normalizedAlias: true, ingredient: { select: { inciName: true } } },
      }),
    ]);
    const canonicalByKey = new Map(
      ingredients.map((ingredient) => [ingredient.normalizedName, ingredient.inciName]),
    );

    for (const alias of aliases) {
      canonicalByKey.set(alias.normalizedAlias, alias.ingredient.inciName);
    }

    return [...new Set(keys.map((key) => canonicalByKey.get(key) ?? key))];
  }

  private async resolveOrCreate(database: IngredientDatabase, input: IngredientInput) {
    const canonicalName = normalizeIngredientName(input.inciName);
    const update = this.metadataUpdate(input);
    const existing = await database.ingredient.findUnique({
      where: { normalizedName: canonicalName },
    });

    if (existing) {
      return Object.keys(update).length > 0
        ? database.ingredient.update({ where: { id: existing.id }, data: update })
        : existing;
    }

    const alias = await database.ingredientAlias.findUnique({
      where: { normalizedAlias: canonicalName },
      include: { ingredient: true },
    });

    if (alias) {
      return Object.keys(update).length > 0
        ? database.ingredient.update({ where: { id: alias.ingredientId }, data: update })
        : alias.ingredient;
    }

    return database.ingredient.create({
      data: {
        inciName: canonicalName,
        normalizedName: canonicalName,
        slug: await this.availableSlug(database, canonicalName),
        commonNames: input.commonNames ?? [],
        functions: input.functions ?? [],
        description: input.description?.trim(),
      },
    });
  }

  private metadataUpdate(input: IngredientInput): Prisma.IngredientUpdateInput {
    return {
      ...(input.commonNames ? { commonNames: this.cleanList(input.commonNames) } : {}),
      ...(input.functions ? { functions: this.cleanList(input.functions) } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
    };
  }

  private cleanList(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  private async availableSlug(database: IngredientDatabase, canonicalName: string): Promise<string> {
    const base = slugify(canonicalName) || 'ingredient';
    const existing = await database.ingredient.findUnique({ where: { slug: base }, select: { id: true } });

    if (!existing) return base;

    const suffix = createHash('sha256').update(canonicalName).digest('hex').slice(0, 8);
    return `${base}-${suffix}`;
  }
}
