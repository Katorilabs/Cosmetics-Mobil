import { z } from 'zod';
import { EvidenceEffect, EvidenceLevel } from '../../generated/prisma/enums.js';

const levelMultipliersSchema = z.object({
  [EvidenceLevel.LOW]: z.number().min(0).max(2),
  [EvidenceLevel.MODERATE]: z.number().min(0).max(2),
  [EvidenceLevel.HIGH]: z.number().min(0).max(2),
}).strict();

export const scoreRuleConditionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('BASE'),
  }).strict(),
  z.object({
    kind: z.literal('EXPLICIT_AVOID'),
    maxMatches: z.number().int().min(1).max(20),
  }).strict(),
  z.object({
    kind: z.literal('EVIDENCE_EFFECT'),
    effect: z.enum([
      EvidenceEffect.BENEFICIAL,
      EvidenceEffect.CAUTION,
      EvidenceEffect.AVOID,
    ]),
    maxMatches: z.number().int().min(1).max(20),
    levelMultipliers: levelMultipliersSchema,
  }).strict(),
]);

export type ScoreRuleCondition = z.infer<typeof scoreRuleConditionSchema>;
