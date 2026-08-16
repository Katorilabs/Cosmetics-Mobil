import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../identity/authenticated-user.js';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import { ListFavoritesQuery } from './dto/list-favorites.query.js';
import { FavoritesService } from './favorites.service.js';

@ApiTags('me/favorites')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'me/favorites', version: '1' })
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated user favorites' })
  listFavorites(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListFavoritesQuery,
  ) {
    return this.favorites.list(user.id, query);
  }

  @Put(':variantId')
  @ApiOperation({ summary: 'Add a published product variant to favorites idempotently' })
  addFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.favorites.add(user.id, variantId);
  }

  @Delete(':variantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Favorite removed' })
  @ApiOperation({ summary: 'Remove a product variant from favorites idempotently' })
  async removeFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ): Promise<void> {
    await this.favorites.remove(user.id, variantId);
  }
}
