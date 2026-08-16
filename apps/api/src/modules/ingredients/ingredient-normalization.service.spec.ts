import { jest } from '@jest/globals';
import type { PrismaService } from '../../database/prisma.service.js';
import {
  IngredientNormalizationService,
  normalizeIngredientName,
} from './ingredient-normalization.service.js';

describe('IngredientNormalizationService', () => {
  it('creates a stable conservative lookup key', () => {
    expect(normalizeIngredientName('  sodium   hyaluronate  ')).toBe('SODIUM HYALURONATE');
    expect(normalizeIngredientName('coco–glucoside')).toBe('COCO-GLUCOSIDE');
  });

  it('resolves reviewed aliases to their canonical INCI record', async () => {
    const canonical = {
      id: 'ingredient-id',
      inciName: 'NIACINAMIDE',
      normalizedName: 'NIACINAMIDE',
    };
    const database = {
      ingredient: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      ingredientAlias: {
        findUnique: jest.fn().mockResolvedValue({
          ingredientId: canonical.id,
          ingredient: canonical,
        }),
      },
    };
    const service = new IngredientNormalizationService({} as PrismaService);

    await expect(service.resolveOrCreateMany(database as never, [
      { inciName: ' Vitamin   B3 ' },
      { inciName: 'vitamin b3' },
    ])).resolves.toEqual([canonical, canonical]);
    expect(database.ingredientAlias.findUnique).toHaveBeenCalledTimes(1);
  });

  it('canonicalizes known aliases while preserving normalized unknown preferences', async () => {
    const prisma = {
      ingredient: {
        findMany: jest.fn().mockResolvedValue([
          { normalizedName: 'PARFUM', inciName: 'PARFUM' },
        ]),
      },
      ingredientAlias: {
        findMany: jest.fn().mockResolvedValue([
          { normalizedAlias: 'VITAMIN B3', ingredient: { inciName: 'NIACINAMIDE' } },
        ]),
      },
    } as unknown as PrismaService;
    const service = new IngredientNormalizationService(prisma);

    await expect(service.resolvePreferenceNames([
      ' parfum ',
      'Vitamin B3',
      'unknown   inci',
      'PARFUM',
    ])).resolves.toEqual(['PARFUM', 'NIACINAMIDE', 'UNKNOWN INCI']);
  });
});
