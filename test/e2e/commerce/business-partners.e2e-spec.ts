import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import {
  getE2eSessionContext,
  hasE2eAuthConfigured,
} from '../helpers/e2e-auth';
import { E2E_RECEPTION_PROVIDER_NIT } from '../../../scripts/e2e-reception-seed.constants';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;

const e2eAuthSuiteLabel = e2eAuthReady
  ? 'con credenciales E2E'
  : 'omitido: defina credenciales en test/.env.e2e';

describe('Commerce / business-partners (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApplication();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/v1/business-partners/search sin Bearer responde 401', () => {
    return request(app.getHttpServer())
      .get('/api/v1/business-partners/search')
      .query({ name: 'test' })
      .expect(401);
  });

  it('GET /api/v1/providers (ruta legacy) responde 404', () => {
    return request(app.getHttpServer())
      .get('/api/v1/providers')
      .expect(404);
  });

  describeE2eAuth(e2eAuthSuiteLabel, () => {
    it('GET /api/v1/providers con Bearer sigue respondiendo 404 (sin alias)', async () => {
      const { accessToken } = await getE2eSessionContext(app);

      const res = await request(app.getHttpServer())
        .get('/api/v1/providers')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });

    it('GET /api/v1/business-partners/search/by-nit encuentra semilla E2E', async () => {
      const { accessToken } = await getE2eSessionContext(app);

      const res = await request(app.getHttpServer())
        .get('/api/v1/business-partners/search/by-nit')
        .query({ query: E2E_RECEPTION_PROVIDER_NIT.slice(0, 6) })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const nits = (res.body as { nit: string }[]).map((p) => p.nit);
      expect(nits).toContain(E2E_RECEPTION_PROVIDER_NIT);
    });

    it('POST /api/v1/business-partners crea tercero y GET por id', async () => {
      const { accessToken } = await getE2eSessionContext(app);
      const uniqueNit = `E2E-BP-${Date.now()}`.slice(0, 20);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/business-partners')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'E2E Business Partner',
          nit: uniqueNit,
          type: 'BUYER',
          extraConfig: { sales: { minWeightKg: 320 } },
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body).toMatchObject({
        name: 'E2E Business Partner',
        nit: uniqueNit,
        type: 'BUYER',
        extraConfig: { sales: { minWeightKg: 320 } },
      });
      expect(createRes.body.id).toBeDefined();

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/business-partners/${createRes.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.nit).toBe(uniqueNit);
    });

    it('GET /api/v1/business-partners/search filtra por type PROVIDER', async () => {
      const { accessToken } = await getE2eSessionContext(app);

      const res = await request(app.getHttpServer())
        .get('/api/v1/business-partners/search')
        .query({ name: 'E2E', type: 'PROVIDER' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const row of res.body as { type: string }[]) {
        expect(row.type).toBe('PROVIDER');
      }
    });
  });
});
