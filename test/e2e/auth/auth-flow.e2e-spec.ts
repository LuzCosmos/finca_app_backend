import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import { hasE2eAuthConfigured, loginE2eViaPassword, resolveE2eAccessToken } from '../helpers/e2e-auth';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;
const e2eAuthSuiteLabel = e2eAuthReady
  ? 'con credenciales E2E'
  : 'con credenciales E2E — omitido: define E2E_USERNAME, E2E_PASSWORD y E2E_COMPANY_USERNAME en test/.env.e2e';

describe('Auth flow (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApplication();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /api/v1/auth/login rechaza body vacío (validación)', () => {
    return request(app.getHttpServer()).post('/api/v1/auth/login').send({}).expect(400);
  });

  it('POST /api/v1/auth/login sin refresh en /auth/refresh rechaza', () => {
    return request(app.getHttpServer()).post('/api/v1/auth/refresh').send({}).expect(401);
  });

  describeE2eAuth(e2eAuthSuiteLabel, () => {
    describe('login por contraseña y refresh', () => {
      it('POST /api/v1/auth/login devuelve 200, access_token, refresh_token y user.tenant_id', async () => {
        const out = await loginE2eViaPassword(app);
        expect(out.access_token.length).toBeGreaterThan(10);
        expect(out.refresh_token.length).toBeGreaterThan(10);
        expect(out.user.tenant_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        expect(out.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });

      it('POST /api/v1/auth/refresh con refresh_token válido devuelve 200 y rota tokens', async () => {
        const { refresh_token: firstRefresh } = await loginE2eViaPassword(app);
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refresh_token: firstRefresh });

        expect(res.status).toBe(200);
        expect(typeof res.body.access_token).toBe('string');
        expect(typeof res.body.refresh_token).toBe('string');
        expect(res.body.refresh_token).not.toBe(firstRefresh);
        expect(res.body.user?.tenant_id).toBeDefined();
      });
    });

    it('GET /api/v1/cattle/search con Bearer', async () => {
      const token = await resolveE2eAccessToken(app);
      if (!token) {
        throw new Error('E2E: credenciales incompletas (revisar test/.env.e2e)');
      }

      const res = await request(app.getHttpServer())
        .get('/api/v1/cattle/search')
        .query({ q: '__e2e_unlikely__' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
