import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomBytes, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import {
  hasE2eAuthConfigured,
  hasE2eLimited403Configured,
  loginE2eLimitedViaPassword,
  loginE2eViaPassword,
} from '../helpers/e2e-auth';
import { Device } from '../../../src/modules/production-center/entities/device.entity';
import { DeviceProfile } from '../../../src/modules/production-center/entities/device-profile.entity';
import { Tenant } from '../../../src/modules/employee-management/entities/tenant.entity';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;
const e2eAuthSuiteLabel = e2eAuthReady
  ? 'list-summary con credenciales E2E'
  : 'list-summary — omitido: defina credenciales en test/.env.e2e';

const e2eLimitedReady = hasE2eAuthConfigured() && hasE2eLimited403Configured();
const it403 = e2eLimitedReady ? it : it.skip;
const skipHint403 =
  'omitido: defina E2E_LIMITED_USERNAME y E2E_LIMITED_PASSWORD en test/.env.e2e (tras npm run seed:e2e)';

function assertListSummaryItemShape(item: Record<string, unknown>): void {
  expect(item).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      name: expect.any(String),
      deveui: expect.any(String),
      isActive: expect.any(Boolean),
    }),
  );
  expect(item).not.toHaveProperty('csAppKey');
  expect(item).not.toHaveProperty('csNwkKey');
  expect(item).not.toHaveProperty('csJoineui');
  expect(item).not.toHaveProperty('tags');
  expect(item).not.toHaveProperty('variables');
}

describe('Production Center / devices list-summary (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const createdDeviceIds: string[] = [];
  const createdDeviceProfileIds: string[] = [];
  const createdTenantIds: string[] = [];

  beforeAll(async () => {
    app = await createE2eApplication();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    try {
      if (dataSource) {
        if (createdDeviceIds.length) {
          await dataSource.getRepository(Device).delete(createdDeviceIds);
        }
        if (createdDeviceProfileIds.length) {
          await dataSource.getRepository(DeviceProfile).delete(createdDeviceProfileIds);
        }
        if (createdTenantIds.length) {
          await dataSource.getRepository(Tenant).delete(createdTenantIds);
        }
      }
    } finally {
      await app?.close();
    }
  });

  it('GET /api/v1/devices/list-summary sin Bearer responde 401', () => {
    return request(app.getHttpServer())
      .get('/api/v1/devices/list-summary')
      .expect(401);
  });

  describeE2eAuth(e2eAuthSuiteLabel, () => {
    it('devuelve dispositivos del tenant ordenados por nombre sin claves LoRaWAN', async () => {
      const login = await loginE2eViaPassword(app);
      const token = login.access_token;
      const tenantId = login.user.tenant_id;

      const suffix = Date.now().toString(36);
      const profileName = `E2E Profile ${suffix}`;
      const nameZ = `E2E-ZZZ-${suffix}`;
      const nameA = `E2E-AAA-${suffix}`;
      const deveuiZ = randomBytes(8).toString('hex');
      const deveuiA = randomBytes(8).toString('hex');

      const deviceProfileRepo = dataSource.getRepository(DeviceProfile);
      const deviceRepo = dataSource.getRepository(Device);

      const deviceProfile = deviceProfileRepo.create({
        idTenant: tenantId,
        name: profileName,
        description: 'E2E list-summary',
        idChipstack: randomUUID(),
        csApplicationId: randomUUID(),
        csJoineui: '0000000000000001',
        csNwkKey: '00000000000000000000000000000002',
        fccId: 'E2E-FCC',
        regions: 'US915',
        model: 'E2E',
      });
      await deviceProfileRepo.save(deviceProfile);
      createdDeviceProfileIds.push(deviceProfile.id);

      const deviceZ = deviceRepo.create({
        deveui: deveuiZ,
        idTenant: tenantId,
        idDeviceProfile: deviceProfile.id,
        name: nameZ,
        description: 'inactive',
        csApplicationId: randomUUID(),
        csAppKey: '00000000000000000000000000000001',
        csNwkKey: '00000000000000000000000000000002',
        tags: { idTenant: tenantId },
        variables: {},
        isActive: false,
        batteryStatus: '42%',
      } as unknown as Device);
      await deviceRepo.save(deviceZ);
      createdDeviceIds.push(deviceZ.id);

      const deviceA = deviceRepo.create({
        deveui: deveuiA,
        idTenant: tenantId,
        idDeviceProfile: deviceProfile.id,
        name: nameA,
        csApplicationId: randomUUID(),
        csAppKey: '00000000000000000000000000000003',
        csNwkKey: '00000000000000000000000000000004',
        tags: {},
        variables: {},
        isActive: true,
        batteryStatus: '90%',
      } as unknown as Device);
      await deviceRepo.save(deviceA);
      createdDeviceIds.push(deviceA.id);

      const res = await request(app.getHttpServer())
        .get('/api/v1/devices/list-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const byDeveui = new Map<string, Record<string, unknown>>(
        res.body.map((row: Record<string, unknown>) => [row.deveui as string, row]),
      );

      expect(byDeveui.has(deveuiA)).toBe(true);
      expect(byDeveui.has(deveuiZ)).toBe(true);

      const rowA = byDeveui.get(deveuiA)!;
      const rowZ = byDeveui.get(deveuiZ)!;

      assertListSummaryItemShape(rowA);
      assertListSummaryItemShape(rowZ);

      expect(rowA.name).toBe(nameA);
      expect(rowA.isActive).toBe(true);
      expect(rowA.batteryStatus).toBe('90%');
      expect(rowA.deviceProfileName).toBe(profileName);

      expect(rowZ.name).toBe(nameZ);
      expect(rowZ.isActive).toBe(false);
      expect(rowZ.batteryStatus).toBe('42%');

      const namesInList = res.body
        .filter((row: { deveui?: string }) => row.deveui === deveuiA || row.deveui === deveuiZ)
        .map((row: { name?: string }) => row.name);
      expect(namesInList).toEqual([nameA, nameZ]);
    });

    it('no incluye dispositivos de otro tenant', async () => {
      const login = await loginE2eViaPassword(app);
      const token = login.access_token;
      const suffix = Date.now().toString(36);

      const tenantRepo = dataSource.getRepository(Tenant);
      const deviceProfileRepo = dataSource.getRepository(DeviceProfile);
      const deviceRepo = dataSource.getRepository(Device);

      const foreignTenant = tenantRepo.create({
        name: `E2E Foreign ${suffix}`,
        company_username: `e2e-foreign-${suffix}-${randomBytes(4).toString('hex')}`,
        status: true,
      });
      await tenantRepo.save(foreignTenant);
      createdTenantIds.push(foreignTenant.id);

      const foreignProfile = deviceProfileRepo.create({
        idTenant: foreignTenant.id,
        name: 'Foreign Profile',
        idChipstack: randomUUID(),
        csApplicationId: randomUUID(),
        csJoineui: '0000000000000002',
        csNwkKey: '00000000000000000000000000000005',
        fccId: 'E2E-FOREIGN',
        regions: 'US915',
        model: 'E2E',
      });
      await deviceProfileRepo.save(foreignProfile);
      createdDeviceProfileIds.push(foreignProfile.id);

      const foreignDeveui = randomBytes(8).toString('hex');
      const foreignDevice = deviceRepo.create({
        deveui: foreignDeveui,
        idTenant: foreignTenant.id,
        idDeviceProfile: foreignProfile.id,
        name: 'E2E-Foreign-Only',
        csApplicationId: randomUUID(),
        tags: {},
        variables: {},
        isActive: true,
      } as unknown as Device);
      await deviceRepo.save(foreignDevice);
      createdDeviceIds.push(foreignDevice.id);

      const res = await request(app.getHttpServer())
        .get('/api/v1/devices/list-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(
        res.body.some((row: { deveui?: string }) => row.deveui === foreignDeveui),
      ).toBe(false);
    });
  });

  describe('403 sin permiso PROD_CENTER/devices', () => {
    it('avisos: requisitos de la prueba HTTP 403 (MANAGER sin PROD_CENTER)', () => {
      if (!e2eLimitedReady) {
        // eslint-disable-next-line no-console -- aviso intencional cuando el caso HTTP 403 está en it.skip
        console.warn(`[e2e] ${skipHint403}`);
      }
      expect(true).toBe(true);
    });

    it403(
      e2eLimitedReady
        ? 'GET /api/v1/devices/list-summary con Bearer MANAGER (sin PROD_CENTER) responde 403'
        : `GET /api/v1/devices/list-summary con Bearer MANAGER (sin PROD_CENTER) responde 403 — ${skipHint403}`,
      async () => {
        const { access_token } = await loginE2eLimitedViaPassword(app);

        const res = await request(app.getHttpServer())
          .get('/api/v1/devices/list-summary')
          .set('Authorization', `Bearer ${access_token}`);

        expect(res.status).toBe(403);
      },
    );
  });
});
