import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../identity/authenticated-user.js';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import { ListProductMatchesQuery } from './dto/list-product-matches.query.js';
import { ProductMatchesService } from './product-matches.service.js';

@ApiTags('me/product-matches')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'me/product-matches', version: '1' })
export class ProductMatchesController {
  constructor(private readonly matches: ProductMatchesService) {}

  @Get()
  @ApiOperation({ summary: 'List explainable product-variant matches for the current skin profile' })
  listMatches(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListProductMatchesQuery,
  ) {
    return this.matches.list(user.id, query);
  }
}
