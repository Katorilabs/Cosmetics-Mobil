import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import type { AuthenticatedUser } from '../identity/authenticated-user.js';
import { ReplaceReviewDto, ReportReviewDto, ReviewPageQuery, WriteReviewDto } from './dto/reviews.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('me/reviews')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'me', version: '1' })
export class MyReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('reviews')
  @ApiOperation({ summary: 'List own reviews, including pending and rejected reviews' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ReviewPageQuery) {
    return this.reviews.listMine(user.id, query);
  }

  @Post('reviews/:variantId')
  @ApiOperation({ summary: 'Create one pending review per variant with a private profile snapshot' })
  create(@CurrentUser() user: AuthenticatedUser, @Param('variantId', ParseUUIDPipe) variantId: string, @Body() input: WriteReviewDto) {
    return this.reviews.create(user.id, variantId, input);
  }

  @Put('reviews/:variantId')
  @ApiOperation({ summary: 'Replace own review text and rating, preserving its original profile snapshot' })
  replace(@CurrentUser() user: AuthenticatedUser, @Param('variantId', ParseUUIDPipe) variantId: string, @Body() input: ReplaceReviewDto) {
    return this.reviews.replace(user.id, variantId, input);
  }

  @Delete('reviews/:variantId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete own review and associated reports idempotently' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('variantId', ParseUUIDPipe) variantId: string) {
    await this.reviews.remove(user.id, variantId);
  }

  @Get('review-statistics/:variantId')
  @ApiOperation({ summary: 'Aggregate published experiences from similar profile snapshots' })
  statistics(@CurrentUser() user: AuthenticatedUser, @Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.reviews.statistics(variantId, user.id);
  }

  @Post('review-reports/:reviewId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Report a published review revision idempotently' })
  report(@CurrentUser() user: AuthenticatedUser, @Param('reviewId', ParseUUIDPipe) reviewId: string, @Body() input: ReportReviewDto) {
    return this.reviews.report(user.id, reviewId, input);
  }
}

@ApiTags('reviews')
@Controller({ path: 'variants/:variantId', version: '1' })
export class PublicReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('reviews')
  @ApiOperation({ summary: 'List published reviews without user identifiers or profile snapshots; render text as plain text' })
  list(@Param('variantId', ParseUUIDPipe) variantId: string, @Query() query: ReviewPageQuery) {
    return this.reviews.listPublic(variantId, query);
  }

  @Get('review-statistics')
  @ApiOperation({ summary: 'Aggregate published user ratings independently of ingredient scores' })
  statistics(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.reviews.statistics(variantId);
  }
}
