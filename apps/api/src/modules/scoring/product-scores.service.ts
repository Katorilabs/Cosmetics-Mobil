import { createHash } from 'node:crypto';
import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { EvidenceEffect, ProductStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import { IngredientNormalizationService } from '../ingredients/ingredient-normalization.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { ScoringEngineService } from './scoring-engine.service.js';

@Injectable()
export class ProductScoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
    private readonly ingredientNormalization: IngredientNormalizationService,
    private readonly engine: ScoringEngineService,
  ) {}

  async get(userId: string, variantId: string) {
    const profile = await this.profiles.get(userId);
    const avoidInci = await this.ingredientNormalization.resolvePreferenceNames(profile.avoidInci);
    const evidenceRelevance: Prisma.IngredientEvidenceWhereInput = {
      reviewedAt: { not: null },
      effect: { in: [EvidenceEffect.BENEFICIAL, EvidenceEffect.CAUTION, EvidenceEffect.AVOID] },
      OR: [
        { skinTypes: { has: profile.skinType } },
        ...(profile.concerns.length > 0 ? [{ concerns: { hasSome: profile.concerns } }] : []),
      ],
    };
    const [variant, activeRule] = await Promise.all([
      this.prisma.productVariant.findFirst({
        where: { id: variantId, isActive: true, product: { status: ProductStatus.PUBLISHED } },
        select: {
          id: true,
          name: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              brand: { select: { id: true, name: true, slug: true } },
              category: { select: { id: true, name: true, slug: true } },
            },
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
                          sourceName: true,
                          sourceUrl: true,
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
      this.prisma.scoreRule.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
        select: { version: true },
      }),
    ]);

    const formula = variant?.formulas[0];
    if (!variant || !formula) {
      throw new NotFoundException({
        code: 'SCORABLE_VARIANT_NOT_FOUND',
        message: 'Published product variant with an active formula not found',
      });
    }
    if (!activeRule) {
      throw new ServiceUnavailableException({
        code: 'SCORING_RULESET_NOT_CONFIGURED',
        message: 'No active score rule set is configured',
      });
    }

    const rules = await this.prisma.scoreRule.findMany({
      where: { version: activeRule.version, isActive: true },
      orderBy: { code: 'asc' },
    });
    let result;
    try {
      result = this.engine.calculate({
        rules: rules.map((rule) => ({
          code: rule.code,
          name: rule.name,
          description: rule.description,
          version: rule.version,
          weight: Number(rule.weight),
          conditions: rule.conditions,
        })),
        ingredients: formula.ingredients,
        avoidInci,
        formulaConfidence: Number(formula.confidence),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'SCORING_RULESET_INVALID',
        message: 'The active score rule set is invalid',
      });
    }

    const profileKey = this.profileKey({
      skinType: profile.skinType,
      concerns: profile.concerns,
      avoidInci,
    });
    const explanation = {
      ...result,
      profile: { skinType: profile.skinType, concerns: [...profile.concerns].sort() },
      formula: { id: formula.id, version: formula.version },
    };
    const snapshot = await this.prisma.scoreSnapshot.upsert({
      where: {
        variantId_formulaId_profileKey_scoringVersion: {
          variantId: variant.id,
          formulaId: formula.id,
          profileKey,
          scoringVersion: activeRule.version,
        },
      },
      update: {},
      create: {
        variantId: variant.id,
        formulaId: formula.id,
        profileKey,
        score: result.score,
        confidence: result.confidence,
        scoringVersion: activeRule.version,
        explanation: explanation as Prisma.InputJsonValue,
      },
    });
    const storedExplanation = snapshot.explanation as { band?: unknown };
    const storedBand = typeof storedExplanation.band === 'string'
      ? storedExplanation.band
      : result.band;

    return {
      variant: {
        id: variant.id,
        name: variant.name,
        product: variant.product,
      },
      formula: { id: formula.id, version: formula.version },
      score: Number(snapshot.score),
      band: storedBand,
      confidence: Number(snapshot.confidence),
      scoringVersion: snapshot.scoringVersion,
      explanation: snapshot.explanation,
      calculatedAt: snapshot.createdAt,
      guidance: {
        meaning: 'PROFILE_FORMULA_MATCH_INDEX',
        medicalAdvice: false,
        safetyGuarantee: false,
        efficacyGuarantee: false,
        formulaConcentrationKnown: false,
      },
    };
  }

  private profileKey(profile: { skinType: string; concerns: string[]; avoidInci: string[] }): string {
    const payload = JSON.stringify({
      version: 1,
      skinType: profile.skinType,
      concerns: [...profile.concerns].sort(),
      avoidInci: [...profile.avoidInci].sort(),
    });

    return `v1:${createHash('sha256').update(payload).digest('hex')}`;
  }
}
