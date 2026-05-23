import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import { hasE2eAuthConfigured, resolveE2eAccessToken } from '../helpers/e2e-auth';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;
const e2eAuthSuiteLabel = e2eAuthReady
  ? 'CRUD ganado con credenciales E2E'
  : 'CRUD ganado — omitido: defina credenciales en test/.env.e2e';

describe('Farm / cattle (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApplication();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/v1/cattle/:id sin Bearer responde 401', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/cattle/${'00000000-0000-4000-8000-000000000001'}`)
      .expect(401);
  });

  describeE2eAuth(e2eAuthSuiteLabel, () => {
    it('crear, leer, buscar, actualizar y 404 por id inexistente', async () => {
      const token = await resolveE2eAccessToken(app);
      if (!token) {
        throw new Error('E2E: credenciales incompletas');
      }

      const suffix = `e2e-${Date.now()}`;
      const createBody = {
        sysNumber: suffix,
        number: suffix,
        receivedAt: '2025-01-15',
        receivedWeight: 350,
        purchaseWeight: 340,
        purchasePrice: 10000,
        lastWeight: 350,
      };

      const created = await request(app.getHttpServer())
        .post('/api/v1/cattle')
        .set('Authorization', `Bearer ${token}`)
        .send(createBody);

      expect(created.status).toBe(201);
      const cattleId = created.body?.id;
      expect(cattleId).toBeDefined();

      const one = await request(app.getHttpServer())
        .get(`/api/v1/cattle/${cattleId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(one.status).toBe(200);
      expect(one.body.number).toBe(suffix);

      const search = await request(app.getHttpServer())
        .get('/api/v1/cattle/search')
        .query({ q: suffix })
        .set('Authorization', `Bearer ${token}`);

      expect(search.status).toBe(200);
      expect(Array.isArray(search.body)).toBe(true);
      expect(search.body.some((c: { id?: string }) => c.id === cattleId)).toBe(true);

      const patched = await request(app.getHttpServer())
        .patch(`/api/v1/cattle/${cattleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ comments: 'e2e-patch' });

      expect(patched.status).toBe(200);

      const missing = await request(app.getHttpServer())
        .get(`/api/v1/cattle/${'00000000-0000-4000-8000-000000000099'}`)
        .set('Authorization', `Bearer ${token}`);

      expect(missing.status).toBe(404);
    });
  });
});
