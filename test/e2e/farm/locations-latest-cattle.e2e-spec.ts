import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import {
  hasE2eAuthConfigured,
  hasE2eLimited403Configured,
  loginE2eLimitedViaPassword,
  loginE2eViaPassword,
} from '../helpers/e2e-auth';
import { Cattle } from '../../../src/modules/farm/entities/cattle.entity';
import { CattleGender } from '../../../src/modules/farm/enums/cattle-gender.enum';
import { Location } from '../../../src/modules/farm/entities/location.entity';
import { Device } from '../../../src/modules/production-center/entities/device.entity';
import { DeviceProfile } from '../../../src/modules/production-center/entities/device-profile.entity';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;
const e2eLimitedReady = hasE2eAuthConfigured() && hasE2eLimited403Configured();
const it403 = e2eLimitedReady ? it : it.skip;
const skipHint403 =
  'omitido: defina E2E_LIMITED_USERNAME y E2E_LIMITED_PASSWORD en test/.env.e2e (tras npm run seed:e2e)';

describe('Locations latest per cattle — permisos (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApplication();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/v1/locations/latest/cattle sin Bearer responde 401', () => {
    return request(app.getHttpServer())
      .get('/api/v1/locations/latest/cattle')
      .expect(401);
  });

  describe('403 sin permiso FARM/locations', () => {
    it('avisos: requisitos de la prueba HTTP 403 (MANAGER sin módulo FARM)', () => {
      if (!e2eLimitedReady) {
        // eslint-disable-next-line no-console -- aviso intencional cuando el caso HTTP 403 está en it.skip
        console.warn(`[e2e] ${skipHint403}`);
      }
      expect(true).toBe(true);
    });

    it403(
      e2eLimitedReady
        ? 'GET /api/v1/locations/latest/cattle con Bearer MANAGER (sin FARM) responde 403'
        : `GET /api/v1/locations/latest/cattle con Bearer MANAGER (sin FARM) responde 403 — ${skipHint403}`,
      async () => {
        const { access_token } = await loginE2eLimitedViaPassword(app);

        const res = await request(app.getHttpServer())
          .get('/api/v1/locations/latest/cattle')
          .set('Authorization', `Bearer ${access_token}`);

        expect(res.status).toBe(403);
      },
    );
  });
});

describeE2eAuth('Locations latest per cattle (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const createdCattleIds: string[] = [];
  const createdLocationIds: string[] = [];
  const createdDeviceIds: string[] = [];
  const createdDeviceProfileIds: string[] = [];

  beforeAll(async () => {
    app = await createE2eApplication();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    try {
      if (dataSource) {
        if (createdLocationIds.length) {
          await dataSource.getRepository(Location).delete(createdLocationIds);
        }
        if (createdDeviceIds.length) {
          await dataSource.getRepository(Device).delete(createdDeviceIds);
        }
        if (createdDeviceProfileIds.length) {
          await dataSource.getRepository(DeviceProfile).delete(createdDeviceProfileIds);
        }
        if (createdCattleIds.length) {
          await dataSource.getRepository(Cattle).delete(createdCattleIds);
        }
      }
    } finally {
      await app?.close();
    }
  });

  it('GET /api/v1/locations/latest/cattle devuelve la última ubicación por res con cattle_number', async () => {
    const login = await loginE2eViaPassword(app);
    const token = login.access_token;
    const tenantId = login.user.tenant_id;

    // Asegura que el módulo FARM incluya la entidad `locations` en `access_details`
    // (algunos entornos E2E pueden no tener la migración aplicada aún).
    await dataSource.query(
      `UPDATE modules SET access_details = '{"brands":"CRUDL","cattle":"CRUDL","locations":"CRUDL"}' WHERE code = 'FARM'`,
    );

    const cattleRepo = dataSource.getRepository(Cattle);
    const locationRepo = dataSource.getRepository(Location);
    const deviceProfileRepo = dataSource.getRepository(DeviceProfile);
    const deviceRepo = dataSource.getRepository(Device);

    const cattle1 = cattleRepo.create({
      idTenant: tenantId,
      sysNumber: 'E2E-SYS-1',
      number: 'E2E-001',
      receivedAt: new Date('2026-01-01'),
      receivedWeight: 300,
      purchaseWeight: 300,
      purchasePrice: 1000,
      purchasedFrom: 'E2E',
      gender: CattleGender.MALE,
      status: 'ACTIVE',
    } as unknown as Cattle);
    await cattleRepo.save(cattle1);
    createdCattleIds.push(cattle1.id);

    const cattle2 = cattleRepo.create({
      idTenant: tenantId,
      sysNumber: 'E2E-SYS-2',
      number: 'E2E-002',
      receivedAt: new Date('2026-01-01'),
      receivedWeight: 320,
      purchaseWeight: 320,
      purchasePrice: 1100,
      purchasedFrom: 'E2E',
      gender: CattleGender.FEMALE,
      status: 'ACTIVE',
    } as unknown as Cattle);
    await cattleRepo.save(cattle2);
    createdCattleIds.push(cattle2.id);

    const deviceProfile = deviceProfileRepo.create({
      idTenant: tenantId,
      name: 'E2E Profile',
      description: 'E2E',
      idChipstack: randomUUID(),
      csApplicationId: randomUUID(),
      csJoineui: '0000000000000000', // 16 chars
      csNwkKey: '00000000000000000000000000000000', // 32 chars
      fccId: 'E2E-FCC',
      regions: 'US915',
      model: 'E2E',
    });
    await deviceProfileRepo.save(deviceProfile);
    createdDeviceProfileIds.push(deviceProfile.id);

    const device1 = deviceRepo.create({
      deveui: '00000000000000000000000000000001', // 32 chars
      idTenant: tenantId,
      idDeviceProfile: deviceProfile.id,
      name: 'E2E Device 1',
      csApplicationId: randomUUID(),
      tags: {},
      variables: {},
      isActive: true,
    } as Device);
    await deviceRepo.save(device1);
    createdDeviceIds.push(device1.id);

    const device2 = deviceRepo.create({
      deveui: '00000000000000000000000000000002', // 32 chars
      idTenant: tenantId,
      idDeviceProfile: deviceProfile.id,
      name: 'E2E Device 2',
      csApplicationId: randomUUID(),
      tags: {},
      variables: {},
      isActive: true,
    } as Device);
    await deviceRepo.save(device2);
    createdDeviceIds.push(device2.id);

    const locOld = locationRepo.create({
      idTenant: tenantId,
      idDevice: device1.id,
      idCattle: cattle1.id,
      latitude: 4.7001,
      longitude: -74.1001,
      altitude: 10,
      time: new Date('2026-05-01T10:00:00.000Z'),
    });
    await locationRepo.save(locOld);
    createdLocationIds.push(locOld.id);

    const locNew = locationRepo.create({
      idTenant: tenantId,
      idDevice: device1.id,
      idCattle: cattle1.id,
      latitude: 4.7002,
      longitude: -74.1002,
      altitude: 12,
      time: new Date('2026-05-01T12:00:00.000Z'),
    });
    await locationRepo.save(locNew);
    createdLocationIds.push(locNew.id);

    const loc2 = locationRepo.create({
      idTenant: tenantId,
      idDevice: device2.id,
      idCattle: cattle2.id,
      latitude: 4.701,
      longitude: -74.101,
      // `altitude` es opcional en entidad; si no hay dato, omitirlo.
      time: new Date('2026-05-01T11:00:00.000Z'),
    });
    await locationRepo.save(loc2);
    createdLocationIds.push(loc2.id);

    const res = await request(app.getHttpServer())
      .get('/api/v1/locations/latest/cattle')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const byNumber = new Map<string, any>(res.body.map((r: any) => [r.cattle_number, r]));

    expect(byNumber.get('E2E-001')).toBeDefined();
    expect(parseFloat(byNumber.get('E2E-001')?.latitude)).toBeCloseTo(4.7002);
    expect(parseFloat(byNumber.get('E2E-001')?.longitude)).toBeCloseTo(-74.1002);
    expect(new Date(byNumber.get('E2E-001')?.time).toISOString()).toBe('2026-05-01T12:00:00.000Z');

    expect(byNumber.get('E2E-002')).toBeDefined();
    expect(new Date(byNumber.get('E2E-002')?.time).toISOString()).toBe('2026-05-01T11:00:00.000Z');
  });
});

