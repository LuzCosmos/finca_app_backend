import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import {
  getE2eSessionContext,
  hasE2eAuthConfigured,
} from '../helpers/e2e-auth';
import { resolveE2eReceptionSeedFromApp } from '../../helpers/e2e-reception-seed';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;

const e2eAuthSuiteLabel = e2eAuthReady
  ? 'con credenciales E2E y semilla de recepción'
  : 'omitido: defina credenciales en test/.env.e2e y ejecute npm run seed:e2e';

describe('Purchase receptions / find-or-create (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApplication();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /purchase-receptions/:idPurchase sin Bearer responde 401', () => {
    return request(app.getHttpServer())
      .get(
        '/api/v1/purchase-receptions/00000000-0000-4000-8000-000000000099',
      )
      .expect(401);
  });

  describeE2eAuth(e2eAuthSuiteLabel, () => {
    it('GET responde 200 aunque birth_date_aprx venga como string (columna date)', async () => {
      const { accessToken, tenantId } = await getE2eSessionContext(app);
      const seed = await resolveE2eReceptionSeedFromApp(app, tenantId);
      if (!seed) {
        throw new Error('E2E: ejecute npm run seed:e2e antes de este test');
      }

      const dataSource = app.get(DataSource);
      await dataSource.query(
        `UPDATE cattle
         SET birth_date_aprx = $1, dental_evaluation_date = $2
         WHERE id = $3 AND id_tenant = $4`,
        ['2019-06-01', '2025-02-10', seed.cattleInLotId, tenantId],
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/purchase-receptions/${seed.purchaseId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body?.reception?.purchaseId).toBe(seed.purchaseId);

      const cattleInLot = (res.body.reception.lots as Array<{ cattle: Array<{ id: string; birthDateAprx?: string }> }>)
        ?.flatMap((l) => l.cattle ?? [])
        .find((c) => c.id === seed.cattleInLotId);
      expect(cattleInLot?.birthDateAprx).toBe('2019-06-01');
    });
  });
});
