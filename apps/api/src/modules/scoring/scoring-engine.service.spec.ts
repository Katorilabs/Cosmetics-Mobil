import { EvidenceEffect, EvidenceLevel } from '../../generated/prisma/enums.js';
import { ScoringEngineService, type ScoringRuleInput } from './scoring-engine.service.js';

const multipliers = { LOW: 0.5, MODERATE: 0.75, HIGH: 1 };
const rules: ScoringRuleInput[] = [
  {
    code: 'BASE_SCORE',
    name: 'Baseline',
    description: 'Neutral starting point',
    version: 1,
    weight: 50,
    conditions: { kind: 'BASE' },
  },
  {
    code: 'EXPLICIT_AVOID_INCI',
    name: 'Explicit avoid',
    description: 'Hard user preference',
    version: 1,
    weight: -100,
    conditions: { kind: 'EXPLICIT_AVOID', maxMatches: 1 },
  },
  {
    code: 'BENEFICIAL',
    name: 'Beneficial evidence',
    description: 'Reviewed beneficial evidence',
    version: 1,
    weight: 10,
    conditions: {
      kind: 'EVIDENCE_EFFECT',
      effect: EvidenceEffect.BENEFICIAL,
      maxMatches: 3,
      levelMultipliers: multipliers,
    },
  },
];

function ingredient(options: {
  inciName: string;
  level?: EvidenceLevel;
  effect?: EvidenceEffect;
}) {
  return {
    rawName: options.inciName,
    isUncertain: false,
    ingredient: {
      inciName: options.inciName,
      evidence: options.level && options.effect
        ? [{
            title: 'Reviewed study',
            summary: 'Test summary',
            sourceName: 'Test source',
            sourceUrl: 'https://example.com/study',
            level: options.level,
            effect: options.effect,
            skinTypes: ['COMBINATION'],
            concerns: ['ACNE'],
          }]
        : [],
    },
  };
}

describe('ScoringEngineService', () => {
  const service = new ScoringEngineService();

  it('applies level-weighted reviewed evidence with a transparent explanation', () => {
    const result = service.calculate({
      rules,
      ingredients: [ingredient({
        inciName: 'NIACINAMIDE',
        level: EvidenceLevel.MODERATE,
        effect: EvidenceEffect.BENEFICIAL,
      })],
      avoidInci: [],
      formulaConfidence: 1,
    });

    expect(result).toMatchObject({
      score: 57.5,
      rawScore: 57.5,
      band: 'MODERATE_MATCH',
      confidence: 1,
      inputQuality: { ingredientCount: 1, resolvedCertainCount: 1, resolutionRatio: 1 },
    });
    expect(result.appliedRules.find((rule) => rule.code === 'BENEFICIAL')).toMatchObject({
      matchCount: 1,
      adjustment: 7.5,
      reasons: [{ ingredient: 'NIACINAMIDE', level: EvidenceLevel.MODERATE }],
    });
  });

  it('clamps an explicit user avoid preference to zero', () => {
    const result = service.calculate({
      rules,
      ingredients: [ingredient({
        inciName: 'PARFUM',
        level: EvidenceLevel.HIGH,
        effect: EvidenceEffect.BENEFICIAL,
      })],
      avoidInci: ['PARFUM'],
      formulaConfidence: 0.8,
    });

    expect(result.score).toBe(0);
    expect(result.band).toBe('LOW_MATCH');
    expect(result.appliedRules.find((rule) => rule.code === 'EXPLICIT_AVOID_INCI'))
      .toMatchObject({ matchCount: 1, adjustment: -100 });
  });

  it('does not double-count multiple studies for the same ingredient and effect', () => {
    const entry = ingredient({
      inciName: 'NIACINAMIDE',
      level: EvidenceLevel.LOW,
      effect: EvidenceEffect.BENEFICIAL,
    });
    entry.ingredient.evidence.push({
      ...entry.ingredient.evidence[0]!,
      title: 'Stronger reviewed study',
      level: EvidenceLevel.HIGH,
    });

    const result = service.calculate({
      rules,
      ingredients: [entry],
      avoidInci: [],
      formulaConfidence: 1,
    });

    expect(result.score).toBe(60);
    expect(result.appliedRules.find((rule) => rule.code === 'BENEFICIAL'))
      .toMatchObject({ matchCount: 1, adjustment: 10 });
  });

  it('reduces input confidence when ingredient resolution is incomplete', () => {
    const result = service.calculate({
      rules,
      ingredients: [{ rawName: 'UNKNOWN', isUncertain: true, ingredient: null }],
      avoidInci: [],
      formulaConfidence: 1,
    });

    expect(result.confidence).toBe(0.5);
    expect(result.score).toBe(50);
  });
});
