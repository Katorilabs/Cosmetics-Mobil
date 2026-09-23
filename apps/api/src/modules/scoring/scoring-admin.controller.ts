import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminKeyGuard } from '../admin/admin-key.guard.js';
import { CreateScoreRuleSetDto } from './dto/create-score-rule-set.dto.js';
import { ListScoreRulesQuery } from './dto/list-score-rules.query.js';
import { ScoreRuleSetsService } from './score-rule-sets.service.js';

@ApiTags('admin/scoring')
@ApiSecurity('admin-key')
@UseGuards(AdminKeyGuard)
@Controller({ path: 'admin/scoring', version: '1' })
export class ScoringAdminController {
  constructor(private readonly ruleSets: ScoreRuleSetsService) {}

  @Get('rules')
  @ApiOperation({ summary: 'List score rules, optionally filtered by version' })
  listRules(@Query() query: ListScoreRulesQuery) {
    return this.ruleSets.list(query.version);
  }

  @Post('rule-sets')
  @ApiOperation({ summary: 'Create an immutable score rule-set version' })
  createRuleSet(@Body() input: CreateScoreRuleSetDto) {
    return this.ruleSets.create(input);
  }

  @Post('rule-sets/:version/activate')
  @ApiOperation({ summary: 'Atomically activate one score rule-set version' })
  activateRuleSet(@Param('version', ParseIntPipe) version: number) {
    return this.ruleSets.activate(version);
  }
}
