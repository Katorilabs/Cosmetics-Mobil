import { Module } from '@nestjs/common';
import { IngredientsModule } from '../ingredients/ingredients.module.js';
import { AdminKeyGuard } from './admin-key.guard.js';
import { CatalogAdminController } from './catalog-admin.controller.js';
import { CatalogAdminService } from './catalog-admin.service.js';
import { CatalogCsvImportService } from './catalog-csv-import.service.js';
import { EvidenceAdminController } from './evidence-admin.controller.js';
import { EvidenceAdminService } from './evidence-admin.service.js';

@Module({
  imports: [IngredientsModule],
  exports: [AdminKeyGuard],
  controllers: [CatalogAdminController, EvidenceAdminController],
  providers: [EvidenceAdminService, AdminKeyGuard, CatalogAdminService, CatalogCsvImportService],
})
export class AdminModule {}
