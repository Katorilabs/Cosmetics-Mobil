import { Injectable } from '@nestjs/common';
import { EvidenceEffect, EvidenceLevel } from '../../generated/prisma/enums.js';
import {
  scoreRuleConditionSchema,
  type ScoreRuleCondition,
} from './score-rule.schema.js';

export type ScoringRuleInput = {
  code: string;
  name: string;
  description: string;
  version: number;
  weight: number;
  conditions: unknown;
};

export type ScoringIngredientInput = {
  rawName: string;
  isUncertain: boolean;
  ingredient: null | {
    inciName: string;
    evidence: Array<{
      title: string;
      summary: string;
      sourceName: string;
      sourceUrl: string;
      level: EvidenceLevel;
      effect: EvidenceEffect;
      skinTypes: string[];
      concerns: string[];
    }>;
  };
};

type ScoringEvidenceInput = NonNullable<ScoringIngredientInput['ingredient']>['evidence'][number];

type AppliedRule = {
  code: string;
  name: string;
  description: string;
  kind: ScoreRuleCondition['kind'];
  weight: number;
  matchCount: number;
  adjustment: number;
  reasons: unknown[];
};

@Injectable()
export class ScoringEngineService {
  calculate(input: {
    rules: ScoringRuleInput[];
    ingredients: ScoringIngredientInput[];
    avoidInci: string[];
    formulaConfidence: number;
  }) {
    const avoidSet = new Set(input.avoidInci);
    const appliedRules = input.rules.map((rule) =>
      this.applyRule(rule, scoreRuleConditionSchema.parse(rule.conditions), input.ingredients, avoidSet));
    const rawScore = appliedRules.reduce((total, rule) => total + rule.adjustment, 0);
    const score = this.round(Math.min(100, Math.max(0, rawScore)), 2);
    const resolvedCertainCount = input.ingredients.filter(
      (entry) => entry.ingredient && !entry.isUncertain,
    ).length;
    const resolutionRatio = input.ingredients.length > 0
      ? resolvedCertainCount / input.ingredients.length
      : 0;
    const confidence = this.round(
      Math.min(1, Math.max(0, input.formulaConfidence)) * (0.5 + (0.5 * resolutionRatio)),
      4,
    );

    return {
      score,
      band: this.band(score),
      confidence,
      rawScore: this.round(rawScore, 4),
      clamp: { minimum: 0, maximum: 100 },
      inputQuality: {
        formulaConfidence: this.round(input.formulaConfidence, 4),
        ingredientCount: input.ingredients.length,
        resolvedCertainCount,
        resolutionRatio: this.round(resolutionRatio, 4),
      },
      appliedRules,
    };
  }

  private applyRule(
    rule: ScoringRuleInput,
    condition: ScoreRuleCondition,
    ingredients: ScoringIngredientInput[],
    avoidSet: Set<string>,
  ): AppliedRule {
    if (condition.kind === 'BASE') {
      return this.applied(rule, condition.kind, 1, rule.weight, [{ reason: 'SCORING_BASELINE' }]);
    }

    if (condition.kind === 'EXPLICIT_AVOID') {
      const matches = ingredients
        .filter((entry) => avoidSet.has(entry.ingredient?.inciName ?? entry.rawName.trim().toUpperCase()))
        .map((entry) => ({ ingredient: entry.ingredient?.inciName ?? entry.rawName }))
        .filter((match, index, all) =>
          all.findIndex((candidate) => candidate.ingredient === match.ingredient) === index)
        .slice(0, condition.maxMatches);

      return this.applied(
        rule,
        condition.kind,
        matches.length,
        rule.weight * matches.length,
        matches,
      );
    }

    const strongestByIngredient = new Map<string, ScoringEvidenceInput>();

    for (const entry of ingredients) {
      if (!entry.ingredient) continue;
      for (const evidence of entry.ingredient.evidence) {
        if (evidence.effect !== condition.effect) continue;
        const current = strongestByIngredient.get(entry.ingredient.inciName);
        if (!current || this.levelRank(evidence.level) > this.levelRank(current.level)) {
          strongestByIngredient.set(entry.ingredient.inciName, evidence);
        }
      }
    }

    const matches = [...strongestByIngredient.entries()]
      .sort((left, right) => this.levelRank(right[1].level) - this.levelRank(left[1].level))
      .slice(0, condition.maxMatches);
    const adjustment = matches.reduce(
      (total, [, evidence]) => total + (rule.weight * condition.levelMultipliers[evidence.level]),
      0,
    );
    const reasons = matches.map(([ingredient, evidence]) => ({
      ingredient,
      effect: evidence.effect,
      level: evidence.level,
      multiplier: condition.levelMultipliers[evidence.level],
      matchedSkinTypes: evidence.skinTypes,
      matchedConcerns: evidence.concerns,
      evidence: {
        title: evidence.title,
        summary: evidence.summary,
        sourceName: evidence.sourceName,
        sourceUrl: evidence.sourceUrl,
      },
    }));

    return this.applied(rule, condition.kind, matches.length, adjustment, reasons);
  }

  private applied(
    rule: ScoringRuleInput,
    kind: ScoreRuleCondition['kind'],
    matchCount: number,
    adjustment: number,
    reasons: unknown[],
  ): AppliedRule {
    return {
      code: rule.code,
      name: rule.name,
      description: rule.description,
      kind,
      weight: rule.weight,
      matchCount,
      adjustment: this.round(adjustment, 4),
      reasons,
    };
  }

  private levelRank(level: EvidenceLevel): number {
    return {
      [EvidenceLevel.LOW]: 1,
      [EvidenceLevel.MODERATE]: 2,
      [EvidenceLevel.HIGH]: 3,
    }[level];
  }

  private band(score: number): 'LOW_MATCH' | 'LIMITED_MATCH' | 'MODERATE_MATCH' | 'STRONG_MATCH' {
    if (score < 25) return 'LOW_MATCH';
    if (score < 50) return 'LIMITED_MATCH';
    if (score < 75) return 'MODERATE_MATCH';
    return 'STRONG_MATCH';
  }

  private round(value: number, digits: number): number {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
}
