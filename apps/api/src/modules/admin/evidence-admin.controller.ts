import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminKeyGuard } from './admin-key.guard.js';
import { EvidenceAdminService } from './evidence-admin.service.js';
import { ListEvidenceQuery } from './dto/list-evidence.query.js';
import { EvidenceRevisionDto, ReplaceEvidenceDto, WriteEvidenceDto } from './dto/write-evidence.dto.js';

@ApiTags('admin/catalog/evidence')
@ApiSecurity('admin-key')
@UseGuards(AdminKeyGuard)
@Controller({ path: 'admin/catalog', version: '1' })
export class EvidenceAdminController {
  constructor(private readonly evidence: EvidenceAdminService) {}

  @Get('evidence')
  @ApiOperation({ summary: 'List evidence with source, ingredient and moderation filters' })
  list(@Query() query: ListEvidenceQuery) { return this.evidence.list(query); }

  @Get('evidence/:id')
  @ApiOperation({ summary: 'Read evidence and its current revision' })
  get(@Param('id', ParseUUIDPipe) id: string) { return this.evidence.get(id); }

  @Post('ingredients/:ingredientId/evidence')
  @ApiOperation({ summary: 'Create pending ingredient evidence with a source citation' })
  create(@Param('ingredientId', ParseUUIDPipe) ingredientId: string, @Body() input: WriteEvidenceDto) {
    return this.evidence.create(ingredientId, input);
  }

  @Put('evidence/:id')
  @ApiOperation({ summary: 'Replace evidence content and clear approval' })
  replace(@Param('id', ParseUUIDPipe) id: string, @Body() input: ReplaceEvidenceDto) {
    return this.evidence.replace(id, input);
  }

  @Post('evidence/:id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve the reviewed revision for matching and scoring' })
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() input: EvidenceRevisionDto) {
    return this.evidence.review(id, input.revision, true);
  }

  @Post('evidence/:id/revoke')
  @HttpCode(200)
  @ApiOperation({ summary: 'Withdraw evidence approval without deleting the record' })
  revoke(@Param('id', ParseUUIDPipe) id: string, @Body() input: EvidenceRevisionDto) {
    return this.evidence.review(id, input.revision, false);
  }
}
