import { Module } from '@nestjs/common';
import { IngredientAliasesService } from './ingredient-aliases.service.js';
import { IngredientNormalizationService } from './ingredient-normalization.service.js';

@Module({
  providers: [IngredientAliasesService, IngredientNormalizationService],
  exports: [IngredientAliasesService, IngredientNormalizationService],
})
export class IngredientsModule {}
