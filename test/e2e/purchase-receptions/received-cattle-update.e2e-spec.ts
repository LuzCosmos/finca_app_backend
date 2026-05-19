import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import {
  getE2eSessionContext,
  hasE2eAuthConfigured,
  hasE2eLimited403Configured,
  loginE2eLimitedViaPassword,
} from '../helpers/e2e-auth';
import {
  E2E_RECEPTION_SEED_EARTAG_DUPLICATE,
  resolveE2eReceptionSeedFromApp,
} from '../../helpers/e2e-reception-seed';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;
const e2eLimitedReady = hasE2eLimited403Configured();
const describeE2eLimited = e2eLimitedReady ? describe : describe.skip;

const e2eAuthSuiteLabel = e2eAuthReady
  ? 'con credenciales E2E y semilla de recepción'
  : 'omitido: defina credenciales en test/.env.e2e y ejecute npm run seed:e2e';

describe('Purchase receptions / received-cattle (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApplication();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('PATCH /purchase-receptions/received-cattle/:id sin Bearer responde 401', () => {
    return request(app.getHttpServer())
      .patch(
        '/api/v1/purchase-receptions/received-cattle/00000000-0000-4000-8000-000000000001',
      )
      .send({ receivedWeight: 400 })
      .expect(401);
  });

  describeE2eAuth(e2eAuthSuiteLabel, () => {
    let seed: Awaited<ReturnType<typeof resolveE2eReceptionSeedFromApp>>;

    beforeAll(async () => {
      const { tenantId } = await getE2eSessionContext(app);
      seed = await resolveE2eReceptionSeedFromApp(app, tenantId);
      if (!seed) {
        throw new Error(
          'E2E: semilla de recepción no encontrada. Ejecute: npm run seed:e2e',
        );
      }
    });

    it('404 si el cattle no existe', async () => {
      const { accessToken } = await getE2eSessionContext(app);
      const res = await request(app.getHttpServer())
        .patch(
          '/api/v1/purchase-receptions/received-cattle/00000000-0000-4000-8000-000000009999',
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ receivedWeight: 400 });

      expect(res.status).toBe(404);
    });

    it('flujo feliz: PATCH actualiza peso y persiste', async () => {
      const { accessToken } = await getE2eSessionContext(app);
      const newWeight = 333.5;

      const patch = await request(app.getHttpServer())
        .patch(
          `/api/v1/purchase-receptions/received-cattle/${seed!.cattleInLotId}`,
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          receivedWeight: newWeight,
          color: 'BLACK',
          hasHorn: true,
        });

      expect(patch.status).toBe(200);
      expect(patch.body.receivedWeight).toBe(newWeight);
      expect(patch.body.hasHorn).toBe(true);

      const getReception = await request(app.getHttpServer())
        .get(`/api/v1/purchase-receptions/${seed!.purchaseId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getReception.status).toBe(200);
      const lots = getReception.body?.reception?.lots as Array<{
        cattle: Array<{ id: string; receivedWeight: number }>;
      }>;
      const cattle = lots
        ?.flatMap((l) => l.cattle ?? [])
        .find((c) => c.id === seed!.cattleInLotId);
      expect(Number(cattle?.receivedWeight)).toBe(newWeight);
    });

    it('409 si arete ya pertenece a otra res', async () => {
      const { accessToken } = await getE2eSessionContext(app);

      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/purchase-receptions/received-cattle/${seed!.cattleInLotId}`,
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ eartagLeft: E2E_RECEPTION_SEED_EARTAG_DUPLICATE });

      expect(res.status).toBe(409);
    });

    it('400 si el lote no pertenece a la compra de la res', async () => {
      const { accessToken, tenantId } = await getE2eSessionContext(app);
      const dataSource = app.get(DataSource);
      const foreignLots = await dataSource.query<{ id: string }[]>(
        `SELECT l.id FROM lots l
         JOIN purchases p ON p.id = l.id_purchase
         WHERE l.id_tenant = $1 AND l.id_purchase <> $2
         LIMIT 1`,
        [tenantId, seed!.purchaseId],
      );
      const foreignLotId = foreignLots[0]?.id;

      if (!foreignLotId) {
        console.warn(
          '[e2e] Omitiendo 400 lote ajeno: no hay otro lote en el tenant.',
        );
        return;
      }

      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/purchase-receptions/received-cattle/${seed!.cattleUnassignedId}`,
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ idLot: foreignLotId });

      expect(res.status).toBe(400);
    });
  });

  describeE2eLimited('sin permiso RECEPTION (MANAGER)', () => {
    it('403 al intentar PATCH received-cattle', async () => {
      const { tenantId } = await getE2eSessionContext(app);
      const seed = await resolveE2eReceptionSeedFromApp(app, tenantId);
      if (!seed) {
        throw new Error('E2E: ejecute npm run seed:e2e antes del test 403');
      }

      const { access_token } = await loginE2eLimitedViaPassword(app);

      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/purchase-receptions/received-cattle/${seed.cattleInLotId}`,
        )
        .set('Authorization', `Bearer ${access_token}`)
        .send({ receivedWeight: 400 });

      expect(res.status).toBe(403);
    });
  });
});
