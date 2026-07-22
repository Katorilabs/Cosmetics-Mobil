import { Module } from '@nestjs/common';
import { AdminKeyGuard } from './admin-key.guard.js';
import { CatalogAdminController } from './catalog-admin.controller.js';
import { CatalogAdminService } from './catalog-admin.service.js';
import { CatalogCsvImportService } from './catalog-csv-import.service.js';

@Module({
  controllers: [CatalogAdminController],
  providers: [AdminKeyGuard, CatalogAdminService, CatalogCsvImportService],
})
export class AdminModule {}
