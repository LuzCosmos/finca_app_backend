import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import {
  getE2eSessionContext,
  hasE2eAuthConfigured,
} from '../helpers/e2e-auth';
import { resolveE2eReceptionSeedFromApp } from '../../helpers/e2e-reception-seed';
import { resolveE2eSalesSeedFromApp } from '../../helpers/e2e-sales-seed';
import {
  E2E_RECEPTION_PROVIDER_NAME,
  E2E_RECEPTION_PROVIDER_NIT,
} from '../../../scripts/e2e-reception-seed.constants';
import { E2E_SALES_BUYER_NIT } from '../../helpers/e2e-sales-seed';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;

const e2eAuthSuiteLabel = e2eAuthReady
  ? 'flujos compra/venta con business_partners'
  : 'omitido: defina credenciales en test/.env.e2e y ejecute npm run seed:e2e';

function buildSaleBody(
  seed: { buyerId: string; cattleId: string; cattleNumber: string },
  overrides?: { notes?: string },
) {
  const measuredWeight = 400;
  const calculatedPrice = 2000;
  return {
    transactionDate: new Date('2025-04-01T12:00:00.000Z').toISOString(),
    buyerId: seed.buyerId,
    minWeightConfig: 300,
    valuePerKgConfig: 5,
    totalAnimalCount: 1,
    totalWeightKg: measuredWeight,
    totalAmount: calculatedPrice,
    notes: overrides?.notes ?? 'e2e sale business partner flow',
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

describe('Commerce / flujos con business partners (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApplication();
  });

  afterAll(async () => {
    await app?.close();
  });

  describeE2eAuth(e2eAuthSuiteLabel, () => {
    it('compra: listado purchases y recepción exponen tercero PROVIDER sembrado', async () => {
      const { accessToken, tenantId } = await getE2eSessionContext(app);
      const seed = await resolveE2eReceptionSeedFromApp(app, tenantId);
      if (!seed) {
        throw new Error('E2E: ejecute npm run seed:e2e antes de este test');
      }

      const purchasesRes = await request(app.getHttpServer())
        .get('/api/v1/purchases')
        .query({ page: 1, limit: 50 })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(purchasesRes.status).toBe(200);
      const items = purchasesRes.body?.items as Array<{
        id: string;
        providerName?: string;
      }>;
      expect(Array.isArray(items)).toBe(true);
      const purchaseRow = items.find((p) => p.id === seed.purchaseId);
      expect(purchaseRow).toBeDefined();
      expect(purchaseRow!.providerName).toBe(E2E_RECEPTION_PROVIDER_NAME);

      const purchaseDetailRes = await request(app.getHttpServer())
        .get(`/api/v1/purchases/${seed.purchaseId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(purchaseDetailRes.status).toBe(200);
      expect(purchaseDetailRes.body?.idProvider).toBe(seed.businessPartnerId);

      const receptionRes = await request(app.getHttpServer())
        .get(`/api/v1/purchase-receptions/${seed.purchaseId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(receptionRes.status).toBe(200);
      expect(receptionRes.body?.reception?.purchaseProviderName).toBe(
        E2E_RECEPTION_PROVIDER_NAME,
      );
      expect(receptionRes.body?.reception?.providerId).toBe(seed.businessPartnerId);

      const searchRes = await request(app.getHttpServer())
        .get('/api/v1/business-partners/search/by-nit')
        .query({ query: E2E_RECEPTION_PROVIDER_NIT.slice(0, 6) })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(searchRes.status).toBe(200);
      const match = (searchRes.body as { id: string; nit: string }[]).find(
        (p) => p.id === seed.businessPartnerId,
      );
      expect(match?.nit).toBe(E2E_RECEPTION_PROVIDER_NIT);
    });

    it('venta: POST sale con buyer de business_partners y GET confirma buyerId', async () => {
      const { accessToken, tenantId } = await getE2eSessionContext(app);
      const seed = await resolveE2eSalesSeedFromApp(app, tenantId);
      if (!seed) {
        throw new Error('E2E: ejecute npm run seed:e2e antes de este test');
      }

      const buyerSearch = await request(app.getHttpServer())
        .get('/api/v1/business-partners/search')
        .query({ name: 'E2E', type: 'BUYER' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(buyerSearch.status).toBe(200);
      const buyers = buyerSearch.body as { id: string; nit: string; type: string }[];
      const e2eBuyer = buyers.find((b) => b.nit === E2E_SALES_BUYER_NIT);
      expect(e2eBuyer).toBeDefined();
      expect(e2eBuyer!.id).toBe(seed.buyerId);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(buildSaleBody(seed, { notes: 'flujo e2e business partner' }));

      expect(createRes.status).toBe(201);
      expect(createRes.body?.buyerId).toBe(seed.buyerId);

      const saleId = createRes.body?.id as string;
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/sales/${saleId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body?.buyerId).toBe(seed.buyerId);
      expect(getRes.body?.notes).toBe('flujo e2e business partner');
    });
  });
});
