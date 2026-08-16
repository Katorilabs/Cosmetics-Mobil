import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  AuthTokenVerifier,
  type VerifiedIdentity,
} from '../src/modules/identity/auth-token.verifier.js';

const VALID_TOKEN = 'e2e-valid-access-token';
const SUBJECT = 'e2e-identity-user';
const FAVORITE_PRODUCT_SLUG = 'e2e-favorite-product';
const AVOIDED_PRODUCT_SLUG = 'e2e-avoided-product';
const FAVORITE_BRAND_SLUG = 'e2e-favorite-brand';
const FAVORITE_CATEGORY_SLUG = 'e2e-favorite-category';
const MATCH_INGREDIENT_NAMES = ['E2E NIACINAMIDE', 'E2E PARFUM'];

class TestTokenVerifier extends AuthTokenVerifier {
  async verify(token: string): Promise<VerifiedIdentity> {
    if (token !== VALID_TOKEN) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Access token is invalid or expired',
      });
    }

    return {
      subject: SUBJECT,
      email: 'identity-e2e@example.com',
      displayName: 'E2E User',
    };
  }
}

describe('Identity and skin profile API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let favoriteVariantId: string;
  let favoriteCategoryId: string;

  const authenticated = () => ({ authorization: `Bearer ${VALID_TOKEN}` });

  async function cleanFixtureData(): Promise<void> {
    await prisma.user.deleteMany({ where: { externalAuthId: SUBJECT } });
    await prisma.product.deleteMany({
      where: { slug: { in: [FAVORITE_PRODUCT_SLUG, AVOIDED_PRODUCT_SLUG] } },
    });
    await prisma.ingredient.deleteMany({
      where: { inciName: { in: MATCH_INGREDIENT_NAMES }, occurrences: { none: {} } },
    });
    await prisma.brand.deleteMany({
      where: { slug: FAVORITE_BRAND_SLUG, products: { none: {} } },
    });
    await prisma.category.deleteMany({
      where: { slug: FAVORITE_CATEGORY_SLUG, products: { none: {} } },
    });
  }

  async function createFavoriteFixture(): Promise<void> {
    const brand = await prisma.brand.create({
      data: { name: 'E2E Favorite Brand', slug: FAVORITE_BRAND_SLUG },
    });
    const category = await prisma.category.create({
      data: { name: 'E2E Favorite Category', slug: FAVORITE_CATEGORY_SLUG },
    });
    favoriteCategoryId = category.id;
    const product = await prisma.product.create({
      data: {
        brandId: brand.id,
        categoryId: category.id,
        name: 'E2E Favorite Product',
        slug: FAVORITE_PRODUCT_SLUG,
        status: 'PUBLISHED',
      },
    });
    const variant = await prisma.productVariant.create({
      data: { productId: product.id, name: '50 ml', sizeValue: 50, sizeUnit: 'ml' },
    });
    favoriteVariantId = variant.id;
    const beneficialIngredient = await prisma.ingredient.create({
      data: {
        inciName: MATCH_INGREDIENT_NAMES[0]!,
        normalizedName: MATCH_INGREDIENT_NAMES[0]!,
        slug: 'e2e-niacinamide',
        commonNames: [],
        functions: [],
      },
    });
    await prisma.formulaVersion.create({
      data: {
        variantId: variant.id,
        version: 1,
        rawInci: MATCH_INGREDIENT_NAMES[0]!,
        sourceName: 'E2E matching fixture',
        confidence: '1.0000',
        isActive: true,
        ingredients: {
          create: {
            ingredientId: beneficialIngredient.id,
            rawName: beneficialIngredient.inciName,
            position: 1,
          },
        },
      },
    });
    await prisma.ingredientEvidence.create({
      data: {
        ingredientId: beneficialIngredient.id,
        title: 'E2E reviewed combination/acne evidence',
        summary: 'E2E-only profile matching evidence',
        sourceUrl: 'https://example.com/e2e-evidence',
        sourceName: 'E2E source',
        level: 'MODERATE',
        effect: 'BENEFICIAL',
        skinTypes: ['COMBINATION'],
        concerns: ['ACNE'],
        reviewedAt: new Date('2026-08-16T00:00:00.000Z'),
      },
    });

    const avoidedProduct = await prisma.product.create({
      data: {
        brandId: brand.id,
        categoryId: category.id,
        name: 'E2E Avoided Product',
        slug: AVOIDED_PRODUCT_SLUG,
        status: 'PUBLISHED',
      },
    });
    const avoidedVariant = await prisma.productVariant.create({
      data: { productId: avoidedProduct.id, name: '30 ml', sizeValue: 30, sizeUnit: 'ml' },
    });
    const avoidedIngredient = await prisma.ingredient.create({
      data: {
        inciName: MATCH_INGREDIENT_NAMES[1]!,
        normalizedName: MATCH_INGREDIENT_NAMES[1]!,
        slug: 'e2e-parfum',
        commonNames: [],
        functions: [],
      },
    });
    await prisma.formulaVersion.create({
      data: {
        variantId: avoidedVariant.id,
        version: 1,
        rawInci: avoidedIngredient.inciName,
        sourceName: 'E2E matching fixture',
        confidence: '1.0000',
        isActive: true,
        ingredients: {
          create: {
            ingredientId: avoidedIngredient.id,
            rawName: avoidedIngredient.inciName,
            position: 1,
          },
        },
      },
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthTokenVerifier)
      .useClass(TestTokenVerifier)
      .compile();

    const expressApp = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(expressApp, { enableShutdownHooks: false });
    await expressApp.init();

    app = expressApp;
    prisma = app.get(PrismaService);
    await cleanFixtureData();
    await createFavoriteFixture();
  });

  afterAll(async () => {
    if (prisma) await cleanFixtureData();
    if (app) await app.close();
  });

  it('requires a Bearer token for the current-user endpoint', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/me').expect(401);

    expect(response.body.error).toMatchObject({ code: 'AUTH_REQUIRED', status: 401 });
  });

  it('rejects an invalid access token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('authorization', 'Bearer invalid-token')
      .expect(401);

    expect(response.body.error).toMatchObject({ code: 'AUTH_TOKEN_INVALID', status: 401 });
  });

  it('creates and returns the application user on first authenticated request', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set(authenticated())
      .expect(200);

    expect(response.body).toMatchObject({
      externalAuthId: SUBJECT,
      email: 'identity-e2e@example.com',
      displayName: 'E2E User',
    });
    await expect(prisma.user.count({ where: { externalAuthId: SUBJECT } })).resolves.toBe(1);
  });

  it('updates editable user fields', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/me')
      .set(authenticated())
      .send({ displayName: '  Bilal  ' })
      .expect(200);

    expect(response.body.displayName).toBe('Bilal');
  });

  it('adds the same published variant to favorites only once', async () => {
    const first = await request(app.getHttpServer())
      .put(`/api/v1/me/favorites/${favoriteVariantId}`)
      .set(authenticated())
      .expect(200);
    const second = await request(app.getHttpServer())
      .put(`/api/v1/me/favorites/${favoriteVariantId}`)
      .set(authenticated())
      .expect(200);

    expect(first.body).toMatchObject({
      variant: {
        id: favoriteVariantId,
        product: { slug: FAVORITE_PRODUCT_SLUG },
      },
    });
    expect(second.body.id).toBe(first.body.id);
    await expect(prisma.favorite.count({
      where: { variantId: favoriteVariantId },
    })).resolves.toBe(1);
  });

  it('returns a paginated favorite list', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/me/favorites')
      .set(authenticated())
      .query({ page: 1, limit: 20 })
      .expect(200);

    expect(response.body.meta).toEqual({ page: 1, limit: 20, total: 1, pageCount: 1 });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      variant: { id: favoriteVariantId, product: { name: 'E2E Favorite Product' } },
    });
  });

  it('removes a favorite idempotently', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/me/favorites/${favoriteVariantId}`)
      .set(authenticated())
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/api/v1/me/favorites/${favoriteVariantId}`)
      .set(authenticated())
      .expect(204);

    const response = await request(app.getHttpServer())
      .get('/api/v1/me/favorites')
      .set(authenticated())
      .expect(200);
    expect(response.body.meta.total).toBe(0);
    expect(response.body.data).toEqual([]);
  });

  it('rejects invalid profile values through the common validation envelope', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/me/skin-profile')
      .set(authenticated())
      .send({
        skinType: 'UNKNOWN',
        concerns: ['ACNE'],
        allergies: [],
        avoidInci: [],
        unexpected: true,
      })
      .expect(400);

    expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED', status: 400 });
  });

  it('creates and normalizes the skin profile', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/me/skin-profile')
      .set(authenticated())
      .send({
        skinType: 'COMBINATION',
        concerns: ['ACNE', 'LARGE_PORES'],
        allergies: [' Fragrance ', 'Latex'],
        avoidInci: [' e2e parfum ', 'alcohol   denat.'],
      })
      .expect(200);

    expect(response.body).toMatchObject({
      skinType: 'COMBINATION',
      concerns: ['ACNE', 'LARGE_PORES'],
      allergies: ['Fragrance', 'Latex'],
      avoidInci: ['E2E PARFUM', 'ALCOHOL DENAT.'],
    });
  });

  it('filters avoided formulas and returns reviewed profile-relevant signals', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/me/product-matches')
      .set(authenticated())
      .query({ categoryId: favoriteCategoryId })
      .expect(200);

    expect(response.body.meta).toMatchObject({
      total: 1,
      profile: { skinType: 'COMBINATION', concerns: ['ACNE', 'LARGE_PORES'] },
      excludeAvoided: true,
    });
    expect(response.body.guidance).toEqual({
      basis: 'REVIEWED_EVIDENCE_AND_USER_PREFERENCES',
      medicalAdvice: false,
      formulaConcentrationKnown: false,
    });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: favoriteVariantId,
      product: { slug: FAVORITE_PRODUCT_SLUG },
      match: {
        status: 'RELEVANT',
        beneficialSignals: [{
          ingredient: 'E2E NIACINAMIDE',
          level: 'MODERATE',
          matchedSkinTypes: ['COMBINATION'],
          matchedConcerns: ['ACNE'],
        }],
      },
    });
  });

  it('shows explicit avoid reasons when the hard filter is disabled', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/me/product-matches')
      .set(authenticated())
      .query({ categoryId: favoriteCategoryId, excludeAvoided: false })
      .expect(200);

    expect(response.body.meta).toMatchObject({ total: 2, excludeAvoided: false });
    const avoided = response.body.data.find(
      (item: { product: { slug: string } }) => item.product.slug === AVOIDED_PRODUCT_SLUG,
    );
    expect(avoided).toMatchObject({
      match: {
        status: 'AVOID',
        explicitAvoidedIngredients: ['E2E PARFUM'],
      },
    });
  });

  it('returns the persisted skin profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/me/skin-profile')
      .set(authenticated())
      .expect(200);

    expect(response.body).toMatchObject({
      skinType: 'COMBINATION',
      concerns: ['ACNE', 'LARGE_PORES'],
    });
  });

  it('removes the skin profile idempotently', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/me/skin-profile')
      .set(authenticated())
      .expect(204);
    await request(app.getHttpServer())
      .delete('/api/v1/me/skin-profile')
      .set(authenticated())
      .expect(204);

    const response = await request(app.getHttpServer())
      .get('/api/v1/me/skin-profile')
      .set(authenticated())
      .expect(404);
    expect(response.body.error).toMatchObject({ code: 'SKIN_PROFILE_NOT_FOUND', status: 404 });

    const matchesResponse = await request(app.getHttpServer())
      .get('/api/v1/me/product-matches')
      .set(authenticated())
      .expect(404);
    expect(matchesResponse.body.error).toMatchObject({
      code: 'SKIN_PROFILE_NOT_FOUND',
      status: 404,
    });
  });
});
