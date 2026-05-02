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
const describeE2e403 = e2eLimitedReady ? describe : describe.skip;
const e2e403Label = e2eLimitedReady
  ? '403 en cattle sin permiso FARM'
  : '403 cattle — omitido: defina E2E_LIMITED_USERNAME y E2E_LIMITED_PASSWORD en test/.env.e2e (tras npm run seed:e2e)';

describe('Farm / cattle permisos (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApplication();
  });

  afterAll(async () => {
    await app?.close();
  });

  describeE2e403(e2e403Label, () => {
    it('GET /api/v1/cattle/search con Bearer MANAGER (sin FARM) responde 403', async () => {
      const { access_token } = await loginE2eLimitedViaPassword(app);

      const res = await request(app.getHttpServer())
        .get('/api/v1/cattle/search')
        .query({ q: 'x' })
        .set('Authorization', `Bearer ${access_token}`);

      expect(res.status).toBe(403);
    });
  });
});
