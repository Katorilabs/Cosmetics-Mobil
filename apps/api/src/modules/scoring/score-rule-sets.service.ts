import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateScoreRuleSetDto } from './dto/create-score-rule-set.dto.js';
import { scoreRuleConditionSchema } from './score-rule.schema.js';

@Injectable()
export class ScoreRuleSetsService {
  constructor(private readonly prisma: PrismaService) {}

  list(version?: number) {
    return this.prisma.scoreRule.findMany({
      where: { version },
      orderBy: [{ version: 'desc' }, { code: 'asc' }],
    });
  }

  async create(input: CreateScoreRuleSetDto) {
    const duplicateCodes = input.rules
      .map((rule) => rule.code)
      .filter((code, index, all) => all.indexOf(code) !== index);
    const parsedRules = input.rules.map((rule) => {
      const parsed = scoreRuleConditionSchema.safeParse(rule.conditions);
      if (!parsed.success) {
        throw new BadRequestException({
          code: 'SCORE_RULESET_INVALID',
          message: `Rule ${rule.code} has invalid conditions`,
          details: parsed.error.flatten(),
        });
      }
      return { ...rule, conditions: parsed.data };
    });
    const baseCount = parsedRules.filter((rule) => rule.conditions.kind === 'BASE').length;

    if (duplicateCodes.length > 0 || baseCount !== 1) {
      throw new BadRequestException({
        code: 'SCORE_RULESET_INVALID',
        message: 'A rule set requires unique codes and exactly one BASE rule',
        details: { duplicateCodes: [...new Set(duplicateCodes)], baseCount },
      });
    }

    const existing = await this.prisma.scoreRule.count({ where: { version: input.version } });
    if (existing > 0) {
      throw new ConflictException({
        code: 'SCORE_RULESET_VERSION_EXISTS',
        message: 'Score rule-set version already exists and is immutable',
      });
    }

    await this.prisma.$transaction(async (transaction) => {
      if (input.activate) {
        await transaction.scoreRule.updateMany({ data: { isActive: false } });
      }
      await transaction.scoreRule.createMany({
        data: parsedRules.map((rule) => ({
          code: rule.code,
          name: rule.name.trim(),
          description: rule.description.trim(),
          version: input.version,
          weight: rule.weight,
          conditions: rule.conditions as Prisma.InputJsonValue,
          isActive: input.activate,
        })),
      });
    });

    return this.list(input.version);
  }

  async activate(version: number) {
    const rules = await this.prisma.scoreRule.findMany({ where: { version } });
    if (rules.length === 0) {
      throw new NotFoundException({
        code: 'SCORE_RULESET_NOT_FOUND',
        message: 'Score rule-set version not found',
      });
    }

    let baseCount = 0;
    for (const rule of rules) {
      const parsed = scoreRuleConditionSchema.safeParse(rule.conditions);
      if (!parsed.success) {
        throw new BadRequestException({
          code: 'SCORE_RULESET_INVALID',
          message: `Rule ${rule.code} has invalid conditions`,
        });
      }
      if (parsed.data.kind === 'BASE') baseCount += 1;
    }
    if (baseCount !== 1) {
      throw new BadRequestException({
        code: 'SCORE_RULESET_INVALID',
        message: 'A rule set requires exactly one BASE rule',
      });
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.scoreRule.updateMany({ data: { isActive: false } });
      await transaction.scoreRule.updateMany({
        where: { version },
        data: { isActive: true },
      });
    });

    return this.list(version);
  }
}
