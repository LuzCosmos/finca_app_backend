import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import { getE2eSessionContext, hasE2eAuthConfigured } from '../helpers/e2e-auth';
import { resolveE2eSalesSeedFromApp } from '../../helpers/e2e-sales-seed';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;

const fakeSaleId = '00000000-0000-4000-8000-000000000099';

function buildSaleBody(
  seed: { buyerId: string; cattleId: string; cattleNumber: string },
  overrides?: { notes?: string; measuredWeight?: number; calculatedPrice?: number },
) {
  const measuredWeight = overrides?.measuredWeight ?? 400;
  const calculatedPrice = overrides?.calculatedPrice ?? 2000;
  return {
    transactionDate: new Date('2025-03-01T12:00:00.000Z').toISOString(),
    buyerId: seed.buyerId,
    minWeightConfig: 300,
    valuePerKgConfig: 5,
    totalAnimalCount: 1,
    totalWeightKg: measuredWeight,
    totalAmount: calculatedPrice,
    notes: overrides?.notes ?? 'e2e sale',
    details: [
      {
        cattleId: seed.cattleId,
        cattleNumber: seed.cattleNumber,
        measuredWeight,
        calculatedPrice,
        isApproved: true,
        trackerRemoved: false,
      },
    ],
  };
}

describe('Commerce / sales update (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApplication();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('PUT /api/v1/sales/:id sin Bearer responde 401', () => {
    return request(app.getHttpServer())
      .put(`/api/v1/sales/${fakeSaleId}`)
      .send({})
      .expect(401);
  });

  describeE2eAuth('con credenciales E2E', () => {
    it('GET /api/v1/sales/:id inexistente responde 404', async () => {
      const { accessToken } = await getE2eSessionContext(app);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/sales/${fakeSaleId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });

    it('PUT /api/v1/sales/:id inexistente responde 404', async () => {
      const { accessToken } = await getE2eSessionContext(app);
      const seed = await resolveE2eSalesSeedFromApp(app, (await getE2eSessionContext(app)).tenantId);
      if (!seed) {
        throw new Error('E2E: ejecute npm run seed:e2e antes de este test');
      }

      const res = await request(app.getHttpServer())
        .put(`/api/v1/sales/${fakeSaleId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(buildSaleBody(seed));

      expect(res.status).toBe(404);
    });

    it('POST crea venta y PUT actualiza cabecera y detalle (200)', async () => {
      const { accessToken, tenantId } = await getE2eSessionContext(app);
      const seed = await resolveE2eSalesSeedFromApp(app, tenantId);
      if (!seed) {
        throw new Error('E2E: ejecute npm run seed:e2e antes de este test');
      }

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(buildSaleBody(seed, { notes: 'antes' }));

      expect(createRes.status).toBe(201);
      const saleId = createRes.body?.id as string;
      expect(saleId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );

      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/sales/${saleId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(
          buildSaleBody(seed, {
            notes: 'despues e2e',
            measuredWeight: 410,
            calculatedPrice: 2050,
          }),
        );

      expect(updateRes.status).toBe(200);
      expect(Number(updateRes.body?.totalAmount)).toBe(2050);
      expect(updateRes.body?.notes).toBe('despues e2e');

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/sales/${saleId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getRes.status).toBe(200);
      expect(Number(getRes.body?.totalWeightKg)).toBe(410);
    });
  });
});
