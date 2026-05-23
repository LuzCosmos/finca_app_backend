import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import { getE2eSessionContext, hasE2eAuthConfigured, resolveE2eAccessToken } from '../helpers/e2e-auth';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;
const e2eAuthSuiteLabel = e2eAuthReady
  ? 'con credenciales E2E'
  : 'con credenciales E2E — omitido: define E2E_USERNAME, E2E_PASSWORD y E2E_COMPANY_USERNAME en test/.env.e2e';

describe('Flujo E2E autenticado: cattle + sync massive-events (opcional)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApplication();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /api/v1/massive-events/sync sin JWT responde 401', () => {
    return request(app.getHttpServer())
      .post('/api/v1/massive-events/sync')
      .send({ massiveEvents: [] })
      .expect(401);
  });

  describeE2eAuth(e2eAuthSuiteLabel, () => {
    it('sync vacío y búsqueda de ganado', async () => {
      const token = await resolveE2eAccessToken(app);
      if (!token) {
        throw new Error('E2E: credenciales incompletas (revisar test/.env.e2e)');
      }

      const search = await request(app.getHttpServer())
        .get('/api/v1/cattle/search')
        .query({ q: 'x' })
        .set('Authorization', `Bearer ${token}`);

      expect(search.status).toBe(200);
      expect(Array.isArray(search.body)).toBe(true);

      const sync = await request(app.getHttpServer())
        .post('/api/v1/massive-events/sync')
        .set('Authorization', `Bearer ${token}`)
        .send({ massiveEvents: [] });

      expect(sync.status).toBe(200);
      expect(Array.isArray(sync.body)).toBe(true);
      expect(sync.body).toEqual([]);
    });

    it('sync con massive event + simple event y GET por id', async () => {
      const { accessToken, tenantId, userId } = await getE2eSessionContext(app);
      const massiveId = randomUUID();
      const simpleId = randomUUID();
      const eventDate = '2025-06-15T12:00:00.000Z';

      const sync = await request(app.getHttpServer())
        .post('/api/v1/massive-events/sync')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          massiveEvents: [
            {
              id: massiveId,
              idTenant: tenantId,
              name: 'E2E sync evento',
              eventDate,
              status: 'open',
              createdBy: userId,
              simpleEvents: [{ id: simpleId, type: 'castration' }],
            },
          ],
        });

      expect(sync.status).toBe(200);
      expect(sync.body).toEqual([{ id: massiveId, status: 'synced' }]);

      const one = await request(app.getHttpServer())
        .get(`/api/v1/massive-events/${massiveId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(one.status).toBe(200);
      expect(one.body.id).toBe(massiveId);
      expect(one.body.name).toBe('E2E sync evento');
      expect(one.body.status).toBe('open');
    });
  });
});
