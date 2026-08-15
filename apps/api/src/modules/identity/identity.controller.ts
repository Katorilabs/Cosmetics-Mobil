import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from './authenticated-user.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { IdentityService } from './identity.service.js';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'me', version: '1' })
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated application user' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.identity.getById(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update editable fields of the authenticated user' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() input: UpdateMeDto) {
    return this.identity.update(user.id, input);
  }
}
