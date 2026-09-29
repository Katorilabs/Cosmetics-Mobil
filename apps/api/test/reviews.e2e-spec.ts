import { randomUUID } from 'node:crypto';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { AuthTokenVerifier, type VerifiedIdentity } from '../src/modules/identity/auth-token.verifier.js';

const fixture = `reviews-e2e-${randomUUID()}`;
const admin = { 'x-admin-key': process.env.ADMIN_API_KEY! };
class ReviewTokenVerifier extends AuthTokenVerifier {
  async verify(token: string): Promise<VerifiedIdentity> {
    if (!['author', 'other', 'no-profile'].includes(token)) throw new UnauthorizedException();
    return { subject: `${fixture}-${token}` };
  }
}

describe('Reviews, moderation and experience statistics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let variantId: string;
  let productId: string;
  let authorId: string;
  let brandId: string;
  let categoryId: string;
  const auth = (name = 'author') => ({ authorization: `Bearer ${name}` });
  const mine = () => `/api/v1/me/reviews/${variantId}`;
  const publicPath = () => `/api/v1/variants/${variantId}/reviews`;
  const statsPath = () => `/api/v1/variants/${variantId}/review-statistics`;
  const similarPath = () => `/api/v1/me/review-statistics/${variantId}`;
  const content = { rating: 4, title: 'My experience', body: 'Worked well in my routine.' };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthTokenVerifier).useClass(ReviewTokenVerifier).compile();
    const expressApp = module.createNestApplication<NestExpressApplication>(new ExpressAdapter());
    configureApp(expressApp, { enableShutdownHooks: false });
    await expressApp.init();
    app = expressApp;
    prisma = app.get(PrismaService);
    const brand = await prisma.brand.create({ data: { name: fixture, slug: fixture } });
    const category = await prisma.category.create({ data: { name: fixture, slug: fixture } });
    brandId = brand.id;
    categoryId = category.id;
    const product = await prisma.product.create({ data: {
      name: fixture, slug: fixture, brandId, categoryId, status: 'PUBLISHED',
      variants: { create: { name: '30 ml' } },
    }, include: { variants: true } });
    productId = product.id;
    variantId = product.variants[0]!.id;
    for (const name of ['author', 'other', 'no-profile']) {
      const user = await request(app.getHttpServer()).get('/api/v1/me').set(auth(name)).expect(200);
      if (name === 'author') authorId = user.body.id;
      if (name !== 'no-profile') {
        await request(app.getHttpServer()).put('/api/v1/me/skin-profile').set(auth(name)).send({
          skinType: 'COMBINATION', concerns: ['ACNE'], allergies: ['Private allergy'], avoidInci: ['PARFUM'],
        }).expect(200);
      }
    }
  });

  beforeEach(async () => {
    await prisma.review.deleteMany({ where: { variantId } });
    await prisma.product.update({ where: { id: productId }, data: { status: 'PUBLISHED' } });
    await prisma.productVariant.update({ where: { id: variantId }, data: { isActive: true } });
    await prisma.skinProfile.update({ where: { userId: authorId }, data: { skinType: 'COMBINATION', concerns: ['ACNE'] } });
  });

  afterAll(async () => {
    if (productId) await prisma.product.delete({ where: { id: productId } });
    if (prisma) await prisma.user.deleteMany({ where: { externalAuthId: { startsWith: fixture } } });
    if (brandId) await prisma.brand.delete({ where: { id: brandId } });
    if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
    if (app) await app.close();
  });

  async function create() {
    return (await request(app.getHttpServer()).post(mine()).set(auth()).send(content).expect(201)).body;
  }
  async function moderate(id: string, revision: number, status = 'PUBLISHED') {
    return (await request(app.getHttpServer()).post(`/api/v1/admin/reviews/${id}/moderate`)
      .set(admin).send({ revision, status }).expect(200)).body;
  }

  it('protects user and moderation endpoints', async () => {
    await request(app.getHttpServer()).get('/api/v1/me/reviews').expect(401);
    await request(app.getHttpServer()).post(mine()).send(content).expect(401);
    await request(app.getHttpServer()).put(mine()).send({ ...content, revision: 1 }).expect(401);
    await request(app.getHttpServer()).delete(mine()).expect(401);
    await request(app.getHttpServer()).get(similarPath()).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/me/review-reports/${randomUUID()}`).expect(401);
    await request(app.getHttpServer()).get('/api/v1/admin/reviews').set(auth()).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/admin/reviews/${randomUUID()}/moderate`).expect(401);
    await request(app.getHttpServer()).get('/api/v1/admin/review-reports').expect(401);
    await request(app.getHttpServer()).post(`/api/v1/admin/review-reports/${randomUUID()}/resolve`).expect(401);
  });

  it('validates ratings, plain text limits, pagination and protected fields', async () => {
    for (const invalid of [
      { rating: 0 }, { rating: 6 }, { rating: 2.5 }, { rating: '4' }, { rating: null },
      { title: ' ' }, { body: 'x'.repeat(5001) }, { status: 'PUBLISHED' },
      { profileSnapshot: { skinType: 'DRY' } }, { userId: randomUUID() },
    ]) {
      await request(app.getHttpServer()).post(mine()).set(auth()).send({ ...content, ...invalid }).expect(400);
    }
    await request(app.getHttpServer()).get(`${publicPath()}?limit=101`).expect(400);
    await request(app.getHttpServer()).get('/api/v1/admin/reviews?status=INVALID').set(admin).expect(400);
    await request(app.getHttpServer()).get('/api/v1/admin/review-reports?state=INVALID').set(admin).expect(400);
  });

  it('requires a profile and a visible variant for submission and statistics', async () => {
    await request(app.getHttpServer()).post(mine()).set(auth('no-profile')).send(content).expect(404);
    await request(app.getHttpServer()).get(similarPath()).set(auth('no-profile')).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/me/reviews/${randomUUID()}`).set(auth()).send(content).expect(404);
    for (const status of ['DRAFT', 'ARCHIVED'] as const) {
      await prisma.product.update({ where: { id: productId }, data: { status } });
      await request(app.getHttpServer()).post(mine()).set(auth()).send(content).expect(404);
      await request(app.getHttpServer()).get(publicPath()).expect(404);
      await request(app.getHttpServer()).get(statsPath()).expect(404);
      await request(app.getHttpServer()).get(similarPath()).set(auth()).expect(404);
    }
    await prisma.product.update({ where: { id: productId }, data: { status: 'PUBLISHED' } });
    await prisma.productVariant.update({ where: { id: variantId }, data: { isActive: false } });
    await request(app.getHttpServer()).post(mine()).set(auth()).send(content).expect(404);
    await request(app.getHttpServer()).get(publicPath()).expect(404);
  });

  it('creates pending reviews with minimal snapshots and keeps them private until publication', async () => {
    const review = await create();
    expect(review).toMatchObject({ rating: 4, revision: 1, status: 'PENDING', profileSnapshot: { version: 1, skinType: 'COMBINATION', concerns: ['ACNE'] } });
    expect(review.profileSnapshot.allergies).toBeUndefined();
    expect(review.profileSnapshot.avoidInci).toBeUndefined();
    expect((await request(app.getHttpServer()).get(publicPath()).expect(200)).body.data).toEqual([]);
    const zero = (await request(app.getHttpServer()).get(statsPath()).expect(200)).body;
    expect(zero).toMatchObject({ count: 0, averageRating: null, distribution: null });
    const own = await request(app.getHttpServer()).get('/api/v1/me/reviews').set(auth()).expect(200);
    expect(own.body.data[0].id).toBe(review.id);
    const others = await request(app.getHttpServer()).get('/api/v1/me/reviews').set(auth('other')).expect(200);
    expect(others.body.data).toEqual([]);
    const queue = await request(app.getHttpServer()).get('/api/v1/admin/reviews').set(admin)
      .query({ status: 'PENDING', variantId, limit: 1 }).expect(200);
    expect(queue.body.meta.total).toBe(1);
    await moderate(review.id, 1);
    const published = (await request(app.getHttpServer()).get(publicPath()).expect(200)).body;
    expect(published.textFormat).toBe('PLAIN_TEXT');
    expect(published.data[0]).toMatchObject({ id: review.id, rating: 4, revision: 2 });
    expect(published.data[0].userId).toBeUndefined();
    expect(published.data[0].profileSnapshot).toBeUndefined();
    const stats = (await request(app.getHttpServer()).get(statsPath()).expect(200)).body;
    expect(stats).toMatchObject({ count: 1, averageRating: 4, guidance: { affectsIngredientScore: false } });
  });

  it('prevents duplicate concurrent submissions and cross-user edits or deletion', async () => {
    const submissions = await Promise.all([1, 2].map(() => request(app.getHttpServer()).post(mine()).set(auth()).send(content)));
    expect(submissions.map((response) => response.status).sort()).toEqual([201, 409]);
    await request(app.getHttpServer()).put(mine()).set(auth('other')).send({ rating: 1, revision: 1 }).expect(404);
    await request(app.getHttpServer()).delete(mine()).set(auth('other')).expect(204);
    expect(await prisma.review.count({ where: { variantId, userId: authorId } })).toBe(1);
  });

  it('preserves the original profile through edits, resets approval and rejects stale moderation', async () => {
    const review = await create();
    await moderate(review.id, 1);
    await prisma.skinProfile.update({ where: { userId: authorId }, data: { skinType: 'DRY', concerns: ['REDNESS'] } });
    const edited = await request(app.getHttpServer()).put(mine()).set(auth()).send({ rating: 2, revision: 2 }).expect(200);
    expect(edited.body).toMatchObject({ title: null, body: null, status: 'PENDING', revision: 3, profileSnapshot: review.profileSnapshot });
    await request(app.getHttpServer()).post(`/api/v1/admin/reviews/${review.id}/moderate`).set(admin)
      .send({ revision: 2, status: 'PUBLISHED' }).expect(409);
    await request(app.getHttpServer()).put(mine()).set(auth()).send({ rating: 5, revision: 2 }).expect(409);
    expect((await request(app.getHttpServer()).get(publicPath()).expect(200)).body.meta.total).toBe(0);
    await moderate(review.id, 3, 'REJECTED');
    expect((await request(app.getHttpServer()).get(statsPath()).expect(200)).body.count).toBe(0);
    await moderate(review.id, 4);
    const results = await Promise.all([
      request(app.getHttpServer()).put(mine()).set(auth()).send({ rating: 5, revision: 5 }),
      request(app.getHttpServer()).post(`/api/v1/admin/reviews/${review.id}/moderate`).set(admin).send({ status: 'REJECTED', revision: 5 }),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
  });

  it('aggregates only published matching snapshots and handles small cohorts and concern-free profiles', async () => {
    const rows = [
      ['COMBINATION', ['ACNE'], 5, 'PUBLISHED'],
      ['COMBINATION', ['ACNE', 'REDNESS'], 4, 'PUBLISHED'],
      ['COMBINATION', ['ACNE'], 3, 'PUBLISHED'],
      ['COMBINATION', ['REDNESS'], 1, 'PUBLISHED'],
      ['DRY', ['ACNE'], 2, 'PUBLISHED'],
      ['COMBINATION', ['ACNE'], 1, 'PENDING'],
      ['COMBINATION', ['ACNE'], 1, 'REJECTED'],
    ] as const;
    for (const [index, row] of rows.entries()) {
      const user = await prisma.user.create({ data: { externalAuthId: `${fixture}-stats-${randomUUID()}` } });
      await prisma.review.create({ data: {
        userId: user.id, variantId, rating: row[2], status: row[3],
        profileSnapshot: { skinType: row[0], concerns: [...row[1]] },
        createdAt: new Date(2020, 0, index + 1),
      } });
    }
    const all = (await request(app.getHttpServer()).get(statsPath()).expect(200)).body;
    expect(all).toMatchObject({ count: 5, averageRating: 3 });
    const similar = (await request(app.getHttpServer()).get(similarPath()).set(auth()).expect(200)).body;
    expect(similar).toMatchObject({ count: 3, averageRating: 4, minimumSampleSize: 3, sufficientData: true });
    expect(similar.distribution.reduce((sum: number, item: { count: number }) => sum + item.count, 0)).toBe(3);
    const page1 = (await request(app.getHttpServer()).get(publicPath()).query({ page: 1, limit: 2 }).expect(200)).body;
    const page2 = (await request(app.getHttpServer()).get(publicPath()).query({ page: 2, limit: 2 }).expect(200)).body;
    expect(page1.meta).toMatchObject({ total: 5, pageCount: 3 });
    expect(page1.data[0].id).not.toBe(page2.data[0].id);
    await prisma.skinProfile.update({ where: { userId: authorId }, data: { skinType: 'DRY' } });
    const small = (await request(app.getHttpServer()).get(similarPath()).set(auth()).expect(200)).body;
    expect(small).toMatchObject({ count: 1, averageRating: null, distribution: null, sufficientData: false });
    await prisma.skinProfile.update({ where: { userId: authorId }, data: { skinType: 'COMBINATION', concerns: [] } });
    const anyConcern = (await request(app.getHttpServer()).get(similarPath()).set(auth()).expect(200)).body;
    expect(anyConcern).toMatchObject({ count: 4, averageRating: 3.25, profile: { concernMatchRequired: false } });
  });

  it('reports published revisions idempotently, resolves reports and allows a report for a new revision', async () => {
    const review = await create();
    const reportPath = `/api/v1/me/review-reports/${review.id}`;
    await request(app.getHttpServer()).post(reportPath).set(auth('other')).send({ revision: 1, reason: 'SPAM' }).expect(404);
    await moderate(review.id, 1);
    await request(app.getHttpServer()).post(reportPath).set(auth('other')).send({ revision: 1, reason: 'SPAM' }).expect(409);
    await request(app.getHttpServer()).post(reportPath).set(auth('other')).send({ revision: 2, reason: 'INVALID' }).expect(400);
    const first = await request(app.getHttpServer()).post(reportPath).set(auth('other')).send({ revision: 2, reason: 'SPAM' }).expect(200);
    const again = await request(app.getHttpServer()).post(reportPath).set(auth('other')).send({ revision: 2, reason: 'OTHER' }).expect(200);
    expect(again.body.id).toBe(first.body.id);
    expect(again.body.userId).toBeUndefined();
    const queue = (await request(app.getHttpServer()).get('/api/v1/admin/review-reports').set(admin).expect(200)).body;
    expect(queue.data.find((item: { id: string }) => item.id === first.body.id)).toMatchObject({ reviewRevision: 2, review: { revision: 2 } });
    await request(app.getHttpServer()).post(`/api/v1/admin/review-reports/${first.body.id}/resolve`).set(admin).expect(204);
    await request(app.getHttpServer()).post(`/api/v1/admin/review-reports/${first.body.id}/resolve`).set(admin).expect(204);
    const resolved = await prisma.reviewReport.findUniqueOrThrow({ where: { id: first.body.id } });
    expect(resolved.resolvedAt).not.toBeNull();
    expect((await request(app.getHttpServer()).get(statsPath()).expect(200)).body.count).toBe(1);
    await request(app.getHttpServer()).put(mine()).set(auth()).send({ ...content, revision: 2 }).expect(200);
    await moderate(review.id, 3);
    const newReport = await request(app.getHttpServer()).post(reportPath).set(auth('other')).send({ revision: 4, reason: 'MISLEADING' }).expect(200);
    expect(newReport.body.id).not.toBe(first.body.id);
    await prisma.product.update({ where: { id: productId }, data: { status: 'ARCHIVED' } });
    await request(app.getHttpServer()).post(reportPath).set(auth('other')).send({ revision: 4, reason: 'SPAM' }).expect(404);
    await request(app.getHttpServer()).delete(mine()).set(auth()).expect(204);
    await request(app.getHttpServer()).delete(mine()).set(auth()).expect(204);
    expect(await prisma.reviewReport.count({ where: { reviewId: review.id } })).toBe(0);
  });
});
