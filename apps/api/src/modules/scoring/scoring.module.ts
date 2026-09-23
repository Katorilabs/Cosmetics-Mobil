import { Module } from '@nestjs/common';
import { AdminKeyGuard } from '../admin/admin-key.guard.js';
import { IdentityModule } from '../identity/identity.module.js';
import { IngredientsModule } from '../ingredients/ingredients.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { ProductScoresController } from './product-scores.controller.js';
import { ProductScoresService } from './product-scores.service.js';
import { ScoreRuleSetsService } from './score-rule-sets.service.js';
import { ScoringAdminController } from './scoring-admin.controller.js';
import { ScoringEngineService } from './scoring-engine.service.js';

@Module({
  imports: [IdentityModule, IngredientsModule, ProfilesModule],
  controllers: [ProductScoresController, ScoringAdminController],
  providers: [AdminKeyGuard, ProductScoresService, ScoreRuleSetsService, ScoringEngineService],
})
export class ScoringModule {}
