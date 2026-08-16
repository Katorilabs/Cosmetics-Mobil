import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { IngredientsModule } from '../ingredients/ingredients.module.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

@Module({
  imports: [IdentityModule, IngredientsModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
