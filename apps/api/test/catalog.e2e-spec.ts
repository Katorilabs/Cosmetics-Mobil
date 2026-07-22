import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY!;
const PRODUCT_SLUG = 'e2e-csv-product';
const BRAND_SLUG = 'e2e-test-lab';
const CATEGORY_SLUG = 'e2e-serum';
const INGREDIENT_NAMES = ['E2E AQUA', 'E2E GLYCERIN', 'E2E NIACINAMIDE'];

const csvContent = [
  'brand,category,product_name,status,variant_name,size_value,size_unit,barcode,raw_inci,inci_names,confidence',
  'E2E Test Lab,E2E Serum,E2E CSV Product,PUBLISHED,30 ml,30,ml,8699999999999,"E2E Aqua, E2E Glycerin, E2E Niacinamide",E2E AQUA|E2E GLYCERIN|E2E NIACINAMIDE,0.95',
].join('\n');

describe('Catalog API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function cleanFixtureData(): Promise<void> {
    await prisma.product.deleteMany({ where: { slug: PRODUCT_SLUG } });
    await prisma.ingredient.deleteMany({
      where: { inciName: { in: INGREDIENT_NAMES }, occurrences: { none: {} } },
    });
    await prisma.brand.deleteMany({ where: { slug: BRAND_SLUG, products: { none: {} } } });
    await prisma.category.deleteMany({ where: { slug: CATEGORY_SLUG, products: { none: {} } } });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const expressApp = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(expressApp, { enableShutdownHooks: false });
    await expressApp.init();

    app = expressApp;
    prisma = app.get(PrismaService);
    await cleanFixtureData();
  });

  afterAll(async () => {
    if (prisma) await cleanFixtureData();
    if (app) await app.close();
  });

  it('reports API and database health', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('protects admin endpoints with the common error envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/catalog/brands')
      .set('x-request-id', 'catalog-e2e-unauthorized')
      .expect(401);

    expect(response.headers['x-request-id']).toBe('catalog-e2e-unauthorized');
    expect(response.body.error).toMatchObject({
      status: 401,
      path: '/api/v1/admin/catalog/brands',
      requestId: 'catalog-e2e-unauthorized',
    });
  });

  it('rejects an invalid CSV before writing data', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/catalog/imports/products')
      .set('x-admin-key', ADMIN_API_KEY)
      .set('content-type', 'text/csv')
      .send('brand,category\nOnly Brand,Only Category')
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: 'CSV_HEADERS_INVALID',
      status: 400,
    });
    await expect(prisma.product.count({ where: { slug: PRODUCT_SLUG } })).resolves.toBe(0);
  });

  it('imports a published product and its formula', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/catalog/imports/products')
      .set('x-admin-key', ADMIN_API_KEY)
      .set('content-type', 'text/csv')
      .send(csvContent)
      .expect(201);

    expect(response.body).toEqual({
      totalRows: 1,
      productsCreated: 1,
      productsUpdated: 0,
      variantsCreated: 1,
      variantsUpdated: 0,
      formulasCreated: 1,
      formulasUnchanged: 0,
      ingredientLinksCreated: 3,
    });
  });

  it('is idempotent when the same CSV is imported again', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/catalog/imports/products')
      .set('x-admin-key', ADMIN_API_KEY)
      .set('content-type', 'application/csv')
      .send(csvContent)
      .expect(201);

    expect(response.body).toMatchObject({
      totalRows: 1,
      productsCreated: 0,
      productsUpdated: 1,
      variantsCreated: 0,
      variantsUpdated: 1,
      formulasCreated: 0,
      formulasUnchanged: 1,
      ingredientLinksCreated: 0,
    });
  });

  it('exposes the imported product through the public catalogue', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/products')
      .query({ search: 'E2E CSV Product' })
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      slug: PRODUCT_SLUG,
      name: 'E2E CSV Product',
    });
  });
});
