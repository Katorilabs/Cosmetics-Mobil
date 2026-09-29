import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';

const admin = { 'x-admin-key': process.env.ADMIN_API_KEY! };
const content = {
  title: 'E2E evidence title', summary: 'Synthetic evidence for API testing only.',
  sourceName: 'E2E journal', sourceUrl: 'https://example.com/e2e-study',
  level: 'MODERATE', effect: 'BENEFICIAL', skinTypes: ['COMBINATION'], concerns: ['ACNE'],
  publishedAt: '2020-01-01T00:00:00.000Z',
};

describe('Evidence management API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ingredientId: string;
  const name = `E2E EVIDENCE ${randomUUID()}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const expressApp = module.createNestApplication<NestExpressApplication>(new ExpressAdapter());
    configureApp(expressApp, { enableShutdownHooks: false });
    await expressApp.init();
    app = expressApp;
    prisma = app.get(PrismaService);
    const ingredient = await prisma.ingredient.create({ data: {
      inciName: name, normalizedName: name, slug: name.toLowerCase().replaceAll(' ', '-'),
      commonNames: [], functions: [],
    } });
    ingredientId = ingredient.id;
  });

  afterAll(async () => {
    if (ingredientId) await prisma.ingredient.delete({ where: { id: ingredientId } });
    if (app) await app.close();
  });

  it('protects every evidence route', async () => {
    const id = randomUUID();
    await request(app.getHttpServer()).get('/api/v1/admin/catalog/evidence').expect(401);
    await request(app.getHttpServer()).get(`/api/v1/admin/catalog/evidence/${id}`).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/admin/catalog/ingredients/${ingredientId}/evidence`).send(content).expect(401);
    await request(app.getHttpServer()).put(`/api/v1/admin/catalog/evidence/${id}`).send({ ...content, revision: 1 }).expect(401);
    for (const action of ['approve', 'revoke']) {
      await request(app.getHttpServer()).post(`/api/v1/admin/catalog/evidence/${id}/${action}`).send({ revision: 1 }).expect(401);
    }
  });

  it('rejects invalid citations, empty content, null required fields and client supplied approval', async () => {
    for (const invalid of [
      { sourceUrl: 'javascript:alert(1)' }, { sourceUrl: 'https://user:password@example.com' },
      { title: '    ' }, { level: null }, { skinTypes: ['UNKNOWN'] }, { concerns: ['ACNE', 'ACNE'] },
      { reviewedAt: '2020-01-01' }, { revision: 1 }, { publishedAt: '2020-02-30' },
    ]) {
      await request(app.getHttpServer()).post(`/api/v1/admin/catalog/ingredients/${ingredientId}/evidence`)
        .set(admin).send({ ...content, ...invalid }).expect(400);
    }
    await request(app.getHttpServer()).get('/api/v1/admin/catalog/evidence?limit=101').set(admin).expect(400);
    await request(app.getHttpServer()).get('/api/v1/admin/catalog/evidence?state=INVALID').set(admin).expect(400);
  });

  it('creates pending citations, filters, approves, resets approval on edit and detects stale revisions', async () => {
    const created = await request(app.getHttpServer()).post(`/api/v1/admin/catalog/ingredients/${ingredientId}/evidence`)
      .set(admin).send(content).expect(201);
    expect(created.body).toMatchObject({ ...content, ingredientId, reviewedAt: null, revision: 1 });
    const path = `/api/v1/admin/catalog/evidence/${created.body.id}`;
    const list = await request(app.getHttpServer()).get('/api/v1/admin/catalog/evidence')
      .query({ ingredientId, state: 'PENDING', search: 'E2E journal', level: 'MODERATE', effect: 'BENEFICIAL' })
      .set(admin).expect(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].id).toBe(created.body.id);
    const approved = await request(app.getHttpServer()).post(`${path}/approve`).set(admin).send({ revision: 1 }).expect(200);
    expect(approved.body.reviewedAt).not.toBeNull();
    expect(approved.body.revision).toBe(2);
    const stale = await request(app.getHttpServer()).put(path).set(admin).send({ ...content, revision: 1 }).expect(409);
    expect(stale.body.error.code).toBe('EVIDENCE_REVISION_CONFLICT');
    const edited = await request(app.getHttpServer()).put(path).set(admin)
      .send({ ...content, title: 'Changed title', publishedAt: null, revision: 2 }).expect(200);
    expect(edited.body).toMatchObject({ reviewedAt: null, revision: 3, publishedAt: null });
    await request(app.getHttpServer()).post(`${path}/approve`).set(admin).send({ revision: 2 }).expect(409);
    await request(app.getHttpServer()).post(`${path}/approve`).set(admin).send({ revision: 3 }).expect(200);
    const revoked = await request(app.getHttpServer()).post(`${path}/revoke`).set(admin).send({ revision: 4 }).expect(200);
    expect(revoked.body).toMatchObject({ reviewedAt: null, revision: 5 });
    await request(app.getHttpServer()).post(`${path}/approve`).set(admin).send({ revision: 4 }).expect(409);
    const fetched = await request(app.getHttpServer()).get(path).set(admin).expect(200);
    expect(fetched.body).toMatchObject({ reviewedAt: null, revision: 5 });
  });

  it('allows only one concurrent moderation operation on a revision', async () => {
    const created = await request(app.getHttpServer()).post(`/api/v1/admin/catalog/ingredients/${ingredientId}/evidence`)
      .set(admin).send(content).expect(201);
    const path = `/api/v1/admin/catalog/evidence/${created.body.id}`;
    const results = await Promise.all(['approve', 'revoke'].map((action) =>
      request(app.getHttpServer()).post(`${path}/${action}`).set(admin).send({ revision: 1 })));
    expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
  });

  it('returns consistent missing-record errors', async () => {
    const id = randomUUID();
    await request(app.getHttpServer()).post(`/api/v1/admin/catalog/ingredients/${id}/evidence`).set(admin).send(content).expect(404);
    for (const action of ['approve', 'revoke']) {
      await request(app.getHttpServer()).post(`/api/v1/admin/catalog/evidence/${id}/${action}`).set(admin).send({ revision: 1 }).expect(404);
    }
    await request(app.getHttpServer()).put(`/api/v1/admin/catalog/evidence/${id}`).set(admin).send({ ...content, revision: 1 }).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/admin/catalog/evidence/${id}`).set(admin).expect(404);
  });
});
