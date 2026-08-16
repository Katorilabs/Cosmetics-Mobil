import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { EvidenceEffect, ProductStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { IngredientNormalizationService } from '../ingredients/ingredient-normalization.service.js';
import type { ListProductMatchesQuery } from './dto/list-product-matches.query.js';

@Injectable()
export class ProductMatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
    private readonly ingredientNormalization: IngredientNormalizationService,
  ) {}

  async list(userId: string, query: ListProductMatchesQuery) {
    const profile = await this.profiles.get(userId);
    const avoidInci = await this.ingredientNormalization.resolvePreferenceNames(profile.avoidInci);
    const evidenceRelevance: Prisma.IngredientEvidenceWhereInput = {
      reviewedAt: { not: null },
      effect: {
        in: [EvidenceEffect.BENEFICIAL, EvidenceEffect.CAUTION, EvidenceEffect.AVOID],
      },
      OR: [
        { skinTypes: { has: profile.skinType } },
        ...(profile.concerns.length > 0
          ? [{ concerns: { hasSome: profile.concerns } }]
          : []),
      ],
    };
    const avoidedIngredient: Prisma.ProductIngredientWhereInput = {
      OR: [
        ...(avoidInci.length > 0
          ? [
              { ingredient: { inciName: { in: avoidInci } } },
              { rawName: { in: avoidInci } },
            ]
          : []),
        {
          ingredient: {
            evidence: {
              some: { ...evidenceRelevance, effect: EvidenceEffect.AVOID },
            },
          },
        },
      ],
    };
    const where: Prisma.ProductVariantWhereInput = {
      isActive: true,
      product: {
        status: ProductStatus.PUBLISHED,
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
      },
      formulas: {
        some: {
          isActive: true,
          ...(query.excludeAvoided ? { ingredients: { none: avoidedIngredient } } : {}),
        },
      },
    };
    const skip = (query.page - 1) * query.limit;
    const [variants, total] = await this.prisma.$transaction([
      this.prisma.productVariant.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          sizeValue: true,
          sizeUnit: true,
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              brand: { select: { id: true, name: true, slug: true } },
              category: { select: { id: true, name: true, slug: true } },
            },
          },
          images: {
            take: 1,
            orderBy: { sortOrder: 'asc' },
            select: { url: true, altText: true },
          },
          formulas: {
            where: { isActive: true },
            orderBy: { version: 'desc' },
            take: 1,
            select: {
              id: true,
              version: true,
              confidence: true,
              ingredients: {
                orderBy: { position: 'asc' },
                select: {
                  position: true,
                  rawName: true,
                  isUncertain: true,
                  ingredient: {
                    select: {
                      inciName: true,
                      evidence: {
                        where: evidenceRelevance,
                        select: {
                          title: true,
                          summary: true,
                          sourceUrl: true,
                          sourceName: true,
                          level: true,
                          effect: true,
                          skinTypes: true,
                          concerns: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.productVariant.count({ where }),
    ]);

    return {
      data: variants.map((variant) => this.toProductMatch(variant, profile, avoidInci)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pageCount: Math.ceil(total / query.limit),
        profile: { skinType: profile.skinType, concerns: profile.concerns },
        excludeAvoided: query.excludeAvoided,
      },
      guidance: {
        basis: 'REVIEWED_EVIDENCE_AND_USER_PREFERENCES',
        medicalAdvice: false,
        formulaConcentrationKnown: false,
      },
    };
  }

  private toProductMatch<Variant extends {
    formulas: Array<{
      ingredients: Array<{
        position: number;
        rawName: string;
        isUncertain: boolean;
        ingredient: null | {
          inciName: string;
          evidence: Array<{
            title: string;
            summary: string;
            sourceUrl: string;
            sourceName: string;
            level: string;
            effect: EvidenceEffect;
            skinTypes: string[];
            concerns: string[];
          }>;
        };
      }>;
      id: string;
      version: number;
      confidence: unknown;
    }>;
  }>(variant: Variant, profile: { skinType: string; concerns: string[] }, avoidInci: string[]) {
    const formula = variant.formulas[0];
    const avoidSet = new Set(avoidInci);
    const explicitAvoidedIngredients = formula?.ingredients
      .filter((entry) =>
        avoidSet.has(entry.rawName.trim().toUpperCase())
        || (entry.ingredient ? avoidSet.has(entry.ingredient.inciName) : false))
      .map((entry) => entry.ingredient?.inciName ?? entry.rawName) ?? [];
    const signals = formula?.ingredients.flatMap((entry) =>
      (entry.ingredient?.evidence ?? []).map((evidence) => ({
        ingredient: entry.ingredient?.inciName ?? entry.rawName,
        effect: evidence.effect,
        level: evidence.level,
        matchedSkinTypes: evidence.skinTypes.filter((skinType) => skinType === profile.skinType),
        matchedConcerns: evidence.concerns.filter((concern) =>
          profile.concerns.includes(concern)),
        evidence: {
          title: evidence.title,
          summary: evidence.summary,
          sourceName: evidence.sourceName,
          sourceUrl: evidence.sourceUrl,
        },
      }))) ?? [];
    const beneficialSignals = signals.filter((signal) => signal.effect === EvidenceEffect.BENEFICIAL);
    const cautionSignals = signals.filter((signal) => signal.effect === EvidenceEffect.CAUTION);
    const avoidSignals = signals.filter((signal) => signal.effect === EvidenceEffect.AVOID);
    const status = explicitAvoidedIngredients.length > 0 || avoidSignals.length > 0
      ? 'AVOID'
      : cautionSignals.length > 0
        ? 'CAUTION'
        : beneficialSignals.length > 0
          ? 'RELEVANT'
          : 'NEUTRAL';

    const { formulas: _formulas, ...variantFields } = variant;
    return {
      ...variantFields,
      formula: formula
        ? {
            id: formula.id,
            version: formula.version,
            confidence: formula.confidence,
            ingredients: formula.ingredients.map((entry) => ({
              position: entry.position,
              rawName: entry.rawName,
              inciName: entry.ingredient?.inciName ?? null,
              isUncertain: entry.isUncertain,
            })),
          }
        : null,
      match: {
        status,
        explicitAvoidedIngredients: [...new Set(explicitAvoidedIngredients)],
        beneficialSignals,
        cautionSignals,
        avoidSignals,
      },
    };
  }
}
