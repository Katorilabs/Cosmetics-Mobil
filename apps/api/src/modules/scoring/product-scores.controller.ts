import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../identity/authenticated-user.js';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import { ProductScoresService } from './product-scores.service.js';

@ApiTags('me/product-scores')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'me/product-scores', version: '1' })
export class ProductScoresController {
  constructor(private readonly scores: ProductScoresService) {}

  @Get(':variantId')
  @ApiOperation({ summary: 'Get a versioned, explainable profile/formula match score' })
  getScore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.scores.get(user.id, variantId);
  }
}
