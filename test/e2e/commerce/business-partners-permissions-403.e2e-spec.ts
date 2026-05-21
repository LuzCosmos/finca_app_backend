import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import {
  hasE2eAuthConfigured,
  hasE2eFarmWorker403Configured,
  loginE2eFarmWorkerViaPassword,
} from '../helpers/e2e-auth';

const e2eFarmWorkerReady = hasE2eAuthConfigured() && hasE2eFarmWorker403Configured();
const it403 = e2eFarmWorkerReady ? it : it.skip;
const skipHint403 =
  'omitido: defina E2E_FARM_WORKER_USERNAME y E2E_FARM_WORKER_PASSWORD en test/.env.e2e (tras npm run seed:e2e)';

describe('Commerce / business-partners permisos (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApplication();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('403 sin módulo COMMERCE (FARM_WORKER)', () => {
    it('avisos: requisitos de la prueba HTTP 403', () => {
      if (!e2eFarmWorkerReady) {
        // eslint-disable-next-line no-console -- aviso intencional cuando el caso HTTP 403 está en it.skip
        console.warn(`[e2e] ${skipHint403}`);
      }
      expect(true).toBe(true);
    });

    it403(
      e2eFarmWorkerReady
        ? 'GET /api/v1/business-partners/search con Bearer FARM_WORKER responde 403'
        : `GET /api/v1/business-partners/search con Bearer FARM_WORKER responde 403 — ${skipHint403}`,
      async () => {
        const { access_token } = await loginE2eFarmWorkerViaPassword(app);

        const res = await request(app.getHttpServer())
          .get('/api/v1/business-partners/search')
          .query({ name: 'E2E' })
          .set('Authorization', `Bearer ${access_token}`);

        expect(res.status).toBe(403);
      },
    );

    it403(
      e2eFarmWorkerReady
        ? 'POST /api/v1/business-partners con Bearer FARM_WORKER responde 403'
        : `POST /api/v1/business-partners con Bearer FARM_WORKER responde 403 — ${skipHint403}`,
      async () => {
        const { access_token } = await loginE2eFarmWorkerViaPassword(app);

        const res = await request(app.getHttpServer())
          .post('/api/v1/business-partners')
          .set('Authorization', `Bearer ${access_token}`)
          .send({
            name: 'Forbidden Partner',
            nit: `E2E-403-${Date.now()}`.slice(0, 20),
            type: 'PROVIDER',
          });

        expect(res.status).toBe(403);
      },
    );
  });
});
