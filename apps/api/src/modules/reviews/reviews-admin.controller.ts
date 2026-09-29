import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminKeyGuard } from '../admin/admin-key.guard.js';
import { AdminReviewsQuery, ListReportsQuery, ModerateReviewDto } from './dto/reviews.dto.js';
import { ReviewsAdminService } from './reviews-admin.service.js';

@ApiTags('admin/reviews')
@ApiSecurity('admin-key')
@UseGuards(AdminKeyGuard)
@Controller({ path: 'admin', version: '1' })
export class ReviewsAdminController {
  constructor(private readonly reviews: ReviewsAdminService) {}

  @Get('reviews')
  @ApiOperation({ summary: 'List reviews for moderation' })
  list(@Query() query: AdminReviewsQuery) { return this.reviews.list(query); }

  @Post('reviews/:id/moderate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish, reject or return a reviewed revision to pending' })
  moderate(@Param('id', ParseUUIDPipe) id: string, @Body() input: ModerateReviewDto) {
    return this.reviews.moderate(id, input);
  }

  @Get('review-reports')
  @ApiOperation({ summary: 'List review reports; compare reported revision with the current review before moderating' })
  reports(@Query() query: ListReportsQuery) { return this.reviews.reports(query); }

  @Post('review-reports/:id/resolve')
  @HttpCode(204)
  @ApiOperation({ summary: 'Resolve a report idempotently without changing review publication' })
  async resolveReport(@Param('id', ParseUUIDPipe) id: string) { await this.reviews.resolveReport(id); }
}
