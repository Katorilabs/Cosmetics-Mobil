import { jest } from '@jest/globals';
import type { PrismaService } from '../../database/prisma.service.js';
import { EvidenceEffect, EvidenceLevel, SkinConcern, SkinType } from '../../generated/prisma/enums.js';
import type { ProfilesService } from '../profiles/profiles.service.js';
import type { IngredientNormalizationService } from '../ingredients/ingredient-normalization.service.js';
import { ProductMatchesService } from './product-matches.service.js';

const profile = {
  id: 'profile-id',
  userId: 'user-id',
  skinType: SkinType.COMBINATION,
  concerns: [SkinConcern.ACNE],
  allergies: [],
  avoidInci: ['PARFUM'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function variantWithIngredient(options: {
  inciName: string;
  effect?: EvidenceEffect;
}) {
  return {
    id: 'variant-id',
    name: '50 ml',
    sizeValue: null,
    sizeUnit: null,
    product: {
      id: 'product-id',
      slug: 'product',
      name: 'Product',
      brand: { id: 'brand-id', name: 'Brand', slug: 'brand' },
      category: { id: 'category-id', name: 'Category', slug: 'category' },
    },
    images: [],
    formulas: [{
      id: 'formula-id',
      version: 1,
      confidence: '1.0000',
      ingredients: [{
        position: 1,
        rawName: options.inciName,
        isUncertain: false,
        ingredient: {
          inciName: options.inciName,
          evidence: options.effect
            ? [{
                title: 'Reviewed evidence',
                summary: 'Profile-relevant evidence summary',
                sourceUrl: 'https://example.com/evidence',
                sourceName: 'Example source',
                level: EvidenceLevel.MODERATE,
                effect: options.effect,
                skinTypes: [SkinType.COMBINATION],
                concerns: [SkinConcern.ACNE],
              }]
            : [],
        },
      }],
    }],
  };
}

describe('ProductMatchesService', () => {
  function createService(variants: unknown[], total = variants.length) {
    const findMany = jest.fn().mockReturnValue('variant-query');
    const count = jest.fn().mockReturnValue('count-query');
    const prisma = {
      productVariant: { findMany, count },
      $transaction: jest.fn().mockResolvedValue([variants, total]),
    } as unknown as PrismaService;
    const profiles = { get: jest.fn().mockResolvedValue(profile) } as unknown as ProfilesService;
    const ingredientNormalization = {
      resolvePreferenceNames: jest.fn().mockResolvedValue(profile.avoidInci),
    } as unknown as IngredientNormalizationService;

    return {
      service: new ProductMatchesService(prisma, profiles, ingredientNormalization),
      findMany,
    };
  }

  it('returns reviewed beneficial evidence as an explainable relevant signal', async () => {
    const { service } = createService([
      variantWithIngredient({ inciName: 'NIACINAMIDE', effect: EvidenceEffect.BENEFICIAL }),
    ]);

    const result = await service.list('user-id', {
      page: 1,
      limit: 20,
      excludeAvoided: true,
    });

    expect(result.data[0]?.match).toMatchObject({
      status: 'RELEVANT',
      explicitAvoidedIngredients: [],
      beneficialSignals: [{
        ingredient: 'NIACINAMIDE',
        level: EvidenceLevel.MODERATE,
        matchedSkinTypes: [SkinType.COMBINATION],
        matchedConcerns: [SkinConcern.ACNE],
      }],
    });
    expect(result.guidance).toEqual({
      basis: 'REVIEWED_EVIDENCE_AND_USER_PREFERENCES',
      medicalAdvice: false,
      formulaConcentrationKnown: false,
    });
  });

  it('marks an explicitly avoided INCI when excluded products are requested', async () => {
    const { service } = createService([variantWithIngredient({ inciName: 'PARFUM' })]);

    const result = await service.list('user-id', {
      page: 1,
      limit: 20,
      excludeAvoided: false,
    });

    expect(result.data[0]?.match).toMatchObject({
      status: 'AVOID',
      explicitAvoidedIngredients: ['PARFUM'],
    });
  });

  it('adds hard avoid predicates when excludeAvoided is enabled', async () => {
    const { service, findMany } = createService([]);

    await service.list('user-id', { page: 1, limit: 20, excludeAvoided: true });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        formulas: {
          some: expect.objectContaining({
            isActive: true,
            ingredients: { none: expect.any(Object) },
          }),
        },
      }),
    }));
  });
});
