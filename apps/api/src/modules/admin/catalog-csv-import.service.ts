import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { slugify } from '../../common/slugify.js';
import { PrismaService } from '../../database/prisma.service.js';
import { ProductStatus } from '../../generated/prisma/enums.js';

const MAX_FILE_BYTES = 1_000_000;
const MAX_ROWS = 1_000;
const MAX_RECORD_BYTES = 50_000;

const requiredHeaders = [
  'brand',
  'category',
  'product_name',
  'variant_name',
  'inci_names',
] as const;

const supportedHeaders = [
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
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined);

const csvRowSchema = z.object({
  brand: z.string().trim().min(2).max(120),
  brand_website: optionalText(2_000).pipe(z.url().optional()),
  category: z.string().trim().min(2).max(120),
  product_name: z.string().trim().min(2).max(200),
  description: optionalText(5_000),
  status: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase() || ProductStatus.DRAFT)
    .pipe(z.enum(ProductStatus)),
  variant_name: z.string().trim().min(1).max(120),
  size_value: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{1,6}(\.\d{1,2})?$/.test(value), {
      message: 'Must be empty or a positive decimal with at most two decimal places',
    })
    .transform((value) => value || undefined),
  size_unit: optionalText(20),
  barcode: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{8,14}$/.test(value), {
      message: 'Must be empty or contain 8 to 14 digits',
    })
    .transform((value) => value || undefined),
  image_url: optionalText(2_000).pipe(z.url().optional()),
  raw_inci: optionalText(20_000),
  inci_names: z
    .string()
    .trim()
    .min(2)
    .max(20_000)
    .transform((value) => value.split('|').map((item) => item.trim().toUpperCase()).filter(Boolean))
    .refine((items) => items.length > 0 && items.length <= 200, {
      message: 'Must contain between 1 and 200 pipe-separated INCI names',
    }),
  source_name: optionalText(200),
  source_url: optionalText(2_000).pipe(z.url().optional()),
  confidence: z
    .string()
    .trim()
    .transform((value) => (value === '' ? 0 : Number(value)))
    .pipe(z.number().min(0).max(1)),
});

type CsvProductRow = z.infer<typeof csvRowSchema>;

export type CsvImportResult = {
  totalRows: number;
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  formulasCreated: number;
  formulasUnchanged: number;
  ingredientLinksCreated: number;
};

@Injectable()
export class CatalogCsvImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importProducts(csvContent: string): Promise<CsvImportResult> {
    const rows = this.parseAndValidate(csvContent);

    return this.prisma.$transaction(
      async (transaction) => {
        const result: CsvImportResult = {
          totalRows: rows.length,
          productsCreated: 0,
          productsUpdated: 0,
          variantsCreated: 0,
          variantsUpdated: 0,
          formulasCreated: 0,
          formulasUnchanged: 0,
          ingredientLinksCreated: 0,
        };

        for (const row of rows) {
          const brandSlug = slugify(row.brand);
          const categorySlug = slugify(row.category);
          const productSlug = slugify(row.product_name);
          const brand = await transaction.brand.upsert({
            where: { slug: brandSlug },
            update: { name: row.brand, website: row.brand_website },
            create: { name: row.brand, slug: brandSlug, website: row.brand_website },
          });
          const category = await transaction.category.upsert({
            where: { slug: categorySlug },
            update: { name: row.category },
            create: { name: row.category, slug: categorySlug },
          });
          const existingProduct = await transaction.product.findUnique({
            where: { slug: productSlug },
            select: { id: true },
          });
          const product = await transaction.product.upsert({
            where: { slug: productSlug },
            update: {
              brandId: brand.id,
              categoryId: category.id,
              name: row.product_name,
              description: row.description,
              status: row.status,
            },
            create: {
              brandId: brand.id,
              categoryId: category.id,
              name: row.product_name,
              slug: productSlug,
              description: row.description,
              status: row.status,
            },
          });

          if (existingProduct) result.productsUpdated += 1;
          else result.productsCreated += 1;

          const variantKey = { productId: product.id, name: row.variant_name };
          const existingVariant = await transaction.productVariant.findUnique({
            where: { productId_name: variantKey },
            select: { id: true },
          });
          const variant = await transaction.productVariant.upsert({
            where: { productId_name: variantKey },
            update: {
              sizeValue: row.size_value,
              sizeUnit: row.size_unit,
              barcode: row.barcode,
              isActive: true,
            },
            create: {
              ...variantKey,
              sizeValue: row.size_value,
              sizeUnit: row.size_unit,
              barcode: row.barcode,
            },
          });

          if (existingVariant) result.variantsUpdated += 1;
          else result.variantsCreated += 1;

          if (row.image_url) {
            const image = await transaction.productImage.findFirst({
              where: { variantId: variant.id, url: row.image_url },
              select: { id: true },
            });
            if (!image) {
              await transaction.productImage.create({
                data: { variantId: variant.id, url: row.image_url, sortOrder: 0 },
              });
            }
          }

          const rawInci = row.raw_inci ?? row.inci_names.join(', ');
          const latestFormula = await transaction.formulaVersion.findFirst({
            where: { variantId: variant.id },
            orderBy: { version: 'desc' },
            select: {
              version: true,
              rawInci: true,
              ingredients: {
                orderBy: { position: 'asc' },
                select: { ingredient: { select: { inciName: true } } },
              },
            },
          });
          const latestInciNames = latestFormula?.ingredients
            .map((item) => item.ingredient?.inciName)
            .filter((item): item is string => Boolean(item)) ?? [];
          const hasSameNormalizedInci = latestInciNames.length === row.inci_names.length
            && latestInciNames.every((inciName, index) => inciName === row.inci_names[index]);

          if (latestFormula?.rawInci === rawInci && hasSameNormalizedInci) {
            result.formulasUnchanged += 1;
            continue;
          }

          await transaction.formulaVersion.updateMany({
            where: { variantId: variant.id, isActive: true },
            data: { isActive: false },
          });
          const ingredients = [];
          for (const inciName of row.inci_names) {
            ingredients.push(
              await transaction.ingredient.upsert({
                where: { inciName },
                update: {},
                create: {
                  inciName,
                  slug: slugify(inciName),
                  commonNames: [],
                  functions: [],
                },
              }),
            );
          }
          await transaction.formulaVersion.create({
            data: {
              variantId: variant.id,
              version: (latestFormula?.version ?? 0) + 1,
              rawInci,
              sourceName: row.source_name,
              sourceUrl: row.source_url,
              confidence: row.confidence,
              isActive: true,
              ingredients: {
                create: ingredients.map((ingredient, index) => ({
                  ingredientId: ingredient.id,
                  rawName: row.inci_names[index] ?? ingredient.inciName,
                  position: index + 1,
                })),
              },
            },
          });
          result.formulasCreated += 1;
          result.ingredientLinksCreated += ingredients.length;
        }

        return result;
      },
      { maxWait: 5_000, timeout: 30_000 },
    );
  }

  parseAndValidate(csvContent: string): CsvProductRow[] {
    if (typeof csvContent !== 'string' || csvContent.trim() === '') {
      throw this.csvError('CSV_EMPTY', 'CSV content is required');
    }
    if (Buffer.byteLength(csvContent, 'utf8') > MAX_FILE_BYTES) {
      throw this.csvError('CSV_TOO_LARGE', `CSV must not exceed ${MAX_FILE_BYTES} bytes`);
    }
    if (csvContent.includes('\0')) {
      throw this.csvError('CSV_INVALID_CHARACTER', 'CSV must not contain null bytes');
    }

    let matrix: string[][];
    try {
      matrix = parse(csvContent, {
        bom: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: false,
        max_record_size: MAX_RECORD_BYTES,
      }) as string[][];
    } catch (error) {
      throw this.csvError('CSV_PARSE_FAILED', 'CSV syntax is invalid', {
        reason: error instanceof Error ? error.message : 'Unknown parser error',
      });
    }

    if (matrix.length < 2) {
      throw this.csvError('CSV_NO_DATA', 'CSV must contain a header and at least one data row');
    }
    if (matrix.length - 1 > MAX_ROWS) {
      throw this.csvError('CSV_TOO_MANY_ROWS', `CSV must not contain more than ${MAX_ROWS} rows`);
    }

    const headers = matrix[0]!.map((header) => header.trim().toLowerCase());
    const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
    const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

    if (duplicateHeaders.length > 0 || missingHeaders.length > 0) {
      throw this.csvError('CSV_HEADERS_INVALID', 'CSV headers are invalid', {
        duplicateHeaders: [...new Set(duplicateHeaders)],
        missingHeaders,
      });
    }

    const issues: Array<{ row: number; fields: Array<{ path: string; message: string }> }> = [];
    const rows: CsvProductRow[] = [];

    matrix.slice(1).forEach((values, index) => {
      const record = {
        ...Object.fromEntries(supportedHeaders.map((header) => [header, ''])),
        ...Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ''])),
      };
      const parsed = csvRowSchema.safeParse(record);

      if (parsed.success) {
        rows.push(parsed.data);
      } else {
        issues.push({
          row: index + 2,
          fields: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }
    });

    if (issues.length > 0) {
      throw this.csvError('CSV_ROWS_INVALID', 'One or more CSV rows are invalid', { rows: issues });
    }

    return rows;
  }

  private csvError(code: string, message: string, details?: unknown): BadRequestException {
    return new BadRequestException({ code, message, details });
  }
}
