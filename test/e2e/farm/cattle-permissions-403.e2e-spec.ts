import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import {
  hasE2eAuthConfigured,
  hasE2eLimited403Configured,
  loginE2eLimitedViaPassword,
} from '../helpers/e2e-auth';

const e2eLimitedReady = hasE2eAuthConfigured() && hasE2eLimited403Configured();
/** Si el único caso es `it.skip`, Jest trata todo el archivo como suite omitida y no lo lista en `--verbose`. */
const it403 = e2eLimitedReady ? it : it.skip;
const skipHint403 =
  'omitido: defina E2E_LIMITED_USERNAME y E2E_LIMITED_PASSWORD en test/.env.e2e (tras npm run seed:e2e)';

describe('Farm / cattle permisos (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApplication();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('403 en cattle sin permiso FARM', () => {
    it('avisos: requisitos de la prueba HTTP 403 (MANAGER sin módulo FARM)', () => {
      if (!e2eLimitedReady) {
        // eslint-disable-next-line no-console -- aviso intencional cuando el caso HTTP 403 está en it.skip
        console.warn(`[e2e] ${skipHint403}`);
      }
      expect(true).toBe(true);
    });

    it403(
      e2eLimitedReady
        ? 'GET /api/v1/cattle/search con Bearer MANAGER (sin FARM) responde 403'
        : `GET /api/v1/cattle/search con Bearer MANAGER (sin FARM) responde 403 — ${skipHint403}`,
      async () => {
        const { access_token } = await loginE2eLimitedViaPassword(app);

        const res = await request(app.getHttpServer())
          .get('/api/v1/cattle/search')
          .query({ q: 'x' })
          .set('Authorization', `Bearer ${access_token}`);

        expect(res.status).toBe(403);
      },
    );
  });
});
