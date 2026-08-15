import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../identity/authenticated-user.js';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import { UpsertSkinProfileDto } from './dto/upsert-skin-profile.dto.js';
import { ProfilesService } from './profiles.service.js';

@ApiTags('me/profile')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'me/skin-profile', version: '1' })
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated user skin profile' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.get(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Create or fully replace the authenticated user skin profile' })
  upsertProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpsertSkinProfileDto,
  ) {
    return this.profiles.upsert(user.id, input);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Skin profile removed' })
  @ApiOperation({ summary: 'Remove the authenticated user skin profile' })
  async removeProfile(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.profiles.remove(user.id);
  }
}
