import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service.js';
import { ProductStatus } from '../../generated/prisma/enums.js';
import { CatalogCsvImportService } from './catalog-csv-import.service.js';

const header = [
  'brand',
  'brand_website',
  'category',
  'product_name',
  'description',
  'status',
  'variant_name',
  'size_value',
  'size_unit',
  'barcode',
  'image_url',
  'raw_inci',
  'inci_names',
  'source_name',
  'source_url',
  'confidence',
].join(',');

describe('CatalogCsvImportService', () => {
  const service = new CatalogCsvImportService({} as PrismaService);

  it('parses BOM, quoted commas and pipe-separated INCI names', () => {
    const csv = `\uFEFF${header}\nCosmedia Demo Lab,https://example.com,Serum,Demo Serum,Demo row,PUBLISHED,30 ml,30.00,ml,8690000000020,,"AQUA, GLYCERIN",AQUA|GLYCERIN,Demo,https://example.com/demo,0.9`;

    expect(service.parseAndValidate(csv)).toEqual([
      expect.objectContaining({
        brand: 'Cosmedia Demo Lab',
        product_name: 'Demo Serum',
        status: ProductStatus.PUBLISHED,
        raw_inci: 'AQUA, GLYCERIN',
        inci_names: ['AQUA', 'GLYCERIN'],
        confidence: 0.9,
      }),
    ]);
  });

  it('accepts a file that omits optional columns', () => {
    const csv = 'brand,category,product_name,variant_name,inci_names\nDemo Lab,Serum,Simple Serum,30 ml,AQUA|GLYCERIN';

    expect(service.parseAndValidate(csv)).toEqual([
      expect.objectContaining({
        status: ProductStatus.DRAFT,
        raw_inci: undefined,
        confidence: 0,
      }),
    ]);
  });

  it('rejects missing required headers with a stable error code', () => {
    expect.assertions(2);

    try {
      service.parseAndValidate('brand,category\nDemo,Serum');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'CSV_HEADERS_INVALID',
      });
    }
  });

  it('reports the physical row number for invalid data', () => {
    expect.assertions(1);
    const csv = `${header}\nX,,Y,Z,,PUBLISHED,V,,,,,,AQUA|GLYCERIN,,,2`;

    try {
      service.parseAndValidate(csv);
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'CSV_ROWS_INVALID',
        details: { rows: [{ row: 2 }] },
      });
    }
  });
});
