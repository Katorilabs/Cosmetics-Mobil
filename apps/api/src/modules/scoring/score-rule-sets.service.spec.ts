import { BadRequestException, ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PrismaService } from '../../database/prisma.service.js';
import { ScoreRuleSetsService } from './score-rule-sets.service.js';

describe('ScoreRuleSetsService', () => {
  it('rejects a rule set without exactly one baseline', async () => {
    const service = new ScoreRuleSetsService({} as PrismaService);

    await expect(service.create({
      version: 2,
      activate: false,
      rules: [{
        code: 'ONLY_EFFECT',
        name: 'Only effect',
        description: 'Missing baseline rule',
        weight: 10,
        conditions: {
          kind: 'EVIDENCE_EFFECT',
          effect: 'BENEFICIAL',
          maxMatches: 1,
          levelMultipliers: { LOW: 0.5, MODERATE: 0.75, HIGH: 1 },
        },
      }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps existing rule-set versions immutable', async () => {
    const prisma = {
      scoreRule: { count: jest.fn().mockResolvedValue(5) },
    } as unknown as PrismaService;
    const service = new ScoreRuleSetsService(prisma);

    await expect(service.create({
      version: 1,
      activate: false,
      rules: [{
        code: 'BASE_SCORE',
        name: 'Baseline',
        description: 'Neutral baseline',
        weight: 50,
        conditions: { kind: 'BASE' },
      }],
    })).rejects.toBeInstanceOf(ConflictException);
  });
});
