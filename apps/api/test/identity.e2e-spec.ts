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

  const authenticated = () => ({ authorization: `Bearer ${VALID_TOKEN}` });

  async function cleanFixtureData(): Promise<void> {
    await prisma.user.deleteMany({ where: { externalAuthId: SUBJECT } });
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
        avoidInci: [' parfum ', 'alcohol   denat.'],
      })
      .expect(200);

    expect(response.body).toMatchObject({
      skinType: 'COMBINATION',
      concerns: ['ACNE', 'LARGE_PORES'],
      allergies: ['Fragrance', 'Latex'],
      avoidInci: ['PARFUM', 'ALCOHOL DENAT.'],
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
  });
});
