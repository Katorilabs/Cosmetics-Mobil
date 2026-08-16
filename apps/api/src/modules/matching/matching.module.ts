import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { IngredientsModule } from '../ingredients/ingredients.module.js';
import { ProductMatchesController } from './product-matches.controller.js';
import { ProductMatchesService } from './product-matches.service.js';

@Module({
  imports: [IdentityModule, IngredientsModule, ProfilesModule],
  controllers: [ProductMatchesController],
  providers: [ProductMatchesService],
})
export class MatchingModule {}
