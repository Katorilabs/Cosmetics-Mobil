import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

@Module({
  imports: [IdentityModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
