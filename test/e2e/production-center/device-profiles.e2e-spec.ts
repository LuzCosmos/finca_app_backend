import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomBytes, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import {
  hasE2eAuthConfigured,
  hasE2eLimited403Configured,
  hasE2eLw001ImportChirpstackConfigured,
  isChirpstackReachableWithConfiguredKey,
  loginE2eLimitedViaPassword,
  loginE2eViaPassword,
} from '../helpers/e2e-auth';
import { DeviceProfile } from '../../../src/modules/production-center/entities/device-profile.entity';
import { Tenant } from '../../../src/modules/employee-management/entities/tenant.entity';
import {
  E2E_LW001_SEED_PROFILE_COLUMN_B_NAME,
  E2E_LW001_SEED_PROFILE_DEFAULT_NAME,
} from '../../helpers/e2e-lw001-seed.constants';
import { resolveLw001AppKeyValue } from '../../../src/modules/production-center/import-lw001/devices-import-lw001.helper';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;
const it403 = hasE2eAuthConfigured() && hasE2eLimited403Configured() ? it : it.skip;
const itChirpstackCreate =
  hasE2eAuthConfigured() && hasE2eLw001ImportChirpstackConfigured() ? it : it.skip;

function authGet(app: INestApplication<App>, token: string, path: string): request.Test {
  return request(app.getHttpServer())
    .get(path)
    .set('Authorization', `Bearer ${token}`);
}

function authPost(
  app: INestApplication<App>,
  token: string,
  path: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(path)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

function authPut(
  app: INestApplication<App>,
  token: string,
  path: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .put(path)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

function authDelete(app: INestApplication<App>, token: string, path: string): request.Test {
  return request(app.getHttpServer())
    .delete(path)
    .set('Authorization', `Bearer ${token}`);
}

describe('Production Center / device-profiles (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createE2eApplication();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/v1/device-profiles sin Bearer responde 401', () => {
    return request(app.getHttpServer()).get('/api/v1/device-profiles').expect(401);
  });

  it403('POST /api/v1/device-profiles con usuario limitado responde 403', async () => {
    const { access_token } = await loginE2eLimitedViaPassword(app);
    await authPost(app, access_token, '/api/v1/device-profiles', {
      name: 'Forbidden profile',
      idChipstack: randomUUID(),
      csApplicationId: randomUUID(),
      csJoineui: '1234568b9d55e072',
      csNwkKey: '000000027a5c8160f8d2a1943eb7c65f',
    }).expect(403);
  });

  describeE2eAuth('con autenticación', () => {
    let accessToken: string;
    let tenantId: string;
    const createdProfileIds: string[] = [];
    const createdTenantIds: string[] = [];
    let chirpstackReachable = false;

    beforeAll(async () => {
      const login = await loginE2eViaPassword(app);
      accessToken = login.access_token;
      tenantId = login.user.tenant_id;
      if (hasE2eLw001ImportChirpstackConfigured()) {
        chirpstackReachable = await isChirpstackReachableWithConfiguredKey();
      }
    });

    afterAll(async () => {
      if (createdProfileIds.length) {
        await dataSource.getRepository(DeviceProfile).delete(createdProfileIds);
      }
      if (createdTenantIds.length) {
        await dataSource.getRepository(Tenant).delete(createdTenantIds);
      }
    });

    it('GET /api/v1/device-profiles lista perfiles del tenant con claves hex válidas', async () => {
      const response = await authGet(app, accessToken, '/api/v1/device-profiles').expect(200);
      expect(Array.isArray(response.body)).toBe(true);

      const seededDefault = response.body.find(
        (p: { name: string }) => p.name === E2E_LW001_SEED_PROFILE_DEFAULT_NAME,
      );
      const seededColumnB = response.body.find(
        (p: { name: string }) => p.name === E2E_LW001_SEED_PROFILE_COLUMN_B_NAME,
      );

      if (seededDefault) {
        expect(resolveLw001AppKeyValue('', seededDefault.csAppKey)).toEqual({
          ok: true,
          value: seededDefault.csAppKey.toLowerCase(),
        });
      }
      if (seededColumnB) {
        expect(seededColumnB.csAppKey).toMatch(/[eE]/);
        expect(resolveLw001AppKeyValue('', seededColumnB.csAppKey).ok).toBe(true);
      }

      for (const item of response.body) {
        expect(item).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            csJoineui: expect.any(String),
            csAppKey: expect.any(String),
            csNwkKey: expect.any(String),
          }),
        );
      }
    });

    it('GET /api/v1/device-profiles/:id devuelve perfil sembrado E2E LW001 Default si existe', async () => {
      const list = await authGet(app, accessToken, '/api/v1/device-profiles').expect(200);
      const seeded = list.body.find(
        (p: { name: string }) => p.name === E2E_LW001_SEED_PROFILE_DEFAULT_NAME,
      );
      if (!seeded) {
        console.warn(
          '[e2e] Omitiendo aserciones de perfil sembrado: ejecute npm run seed:e2e antes de los E2E.',
        );
        return;
      }

      const response = await authGet(
        app,
        accessToken,
        `/api/v1/device-profiles/${seeded.id}`,
      ).expect(200);

      expect(response.body.id).toBe(seeded.id);
      expect(response.body.name).toBe(E2E_LW001_SEED_PROFILE_DEFAULT_NAME);
      expect(response.body.csAppKey).toBe(seeded.csAppKey);
    });

    it('PUT /api/v1/device-profiles/:id actualiza descripción sin tocar ChirpStack', async () => {
      const profileRepo = dataSource.getRepository(DeviceProfile);
      const suffix = Date.now().toString(36);
      const profile = profileRepo.create({
        idTenant: tenantId,
        name: `E2E Profile PUT ${suffix}`,
        description: 'antes',
        idChipstack: randomUUID(),
        csApplicationId: randomUUID(),
        csJoineui: '1234568b9d55e072',
        csAppKey: 'd4e9f3b27a5c8160f8d2a1943eb7c65f',
        csNwkKey: '000000027a5c8160f8d2a1943eb7c65f',
        fccId: 'E2E-FCC',
        regions: 'US915',
        model: 'LW001',
        input: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await profileRepo.save(profile);
      createdProfileIds.push(profile.id);

      const response = await authPut(
        app,
        accessToken,
        `/api/v1/device-profiles/${profile.id}`,
        { description: `actualizado ${suffix}` },
      ).expect(200);

      expect(response.body.description).toBe(`actualizado ${suffix}`);
    });

    it('DELETE /api/v1/device-profiles/:id elimina perfil del tenant', async () => {
      const profileRepo = dataSource.getRepository(DeviceProfile);
      const suffix = Date.now().toString(36);
      const profile = profileRepo.create({
        idTenant: tenantId,
        name: `E2E Profile DELETE ${suffix}`,
        description: 'borrar',
        idChipstack: randomUUID(),
        csApplicationId: randomUUID(),
        csJoineui: '1234568b9d55e072',
        csAppKey: 'd4e9f3b27a5c8160f8d2a1943eb7c65f',
        csNwkKey: '000000027a5c8160f8d2a1943eb7c65f',
        fccId: 'E2E-FCC',
        regions: 'US915',
        model: 'LW001',
        input: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await profileRepo.save(profile);

      await authDelete(app, accessToken, `/api/v1/device-profiles/${profile.id}`).expect(200);

      const remaining = await profileRepo.findOne({ where: { id: profile.id } });
      expect(remaining).toBeNull();
    });

    it('GET /api/v1/device-profiles/:id de otro tenant responde 404', async () => {
      const tenantRepo = dataSource.getRepository(Tenant);
      const profileRepo = dataSource.getRepository(DeviceProfile);
      const suffix = Date.now().toString(36);
      const foreignTenant = tenantRepo.create({
        name: `E2E Foreign DP ${suffix}`,
        company_username: `e2e-fdp-${suffix}-${randomBytes(4).toString('hex')}`,
        status: true,
      });
      await tenantRepo.save(foreignTenant);
      createdTenantIds.push(foreignTenant.id);

      const foreign = profileRepo.create({
        idTenant: foreignTenant.id,
        name: `E2E Foreign ${Date.now()}`,
        description: 'foreign',
        idChipstack: randomUUID(),
        csApplicationId: randomUUID(),
        csJoineui: '1234568b9d55e072',
        csAppKey: 'd4e9f3b27a5c8160f8d2a1943eb7c65f',
        csNwkKey: '000000027a5c8160f8d2a1943eb7c65f',
        fccId: 'E2E-FCC',
        regions: 'US915',
        model: 'LW001',
        input: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await profileRepo.save(foreign);
      createdProfileIds.push(foreign.id);

      await authGet(app, accessToken, `/api/v1/device-profiles/${foreign.id}`).expect(404);
    });

    itChirpstackCreate(
      'POST /api/v1/device-profiles crea perfil cuando ChirpStack responde OK',
      async () => {
        if (!chirpstackReachable) {
          console.warn('[e2e] ChirpStack no accesible; omitiendo POST device-profiles.');
          return;
        }
        const chirpstackProfileId = process.env.E2E_CHIRPSTACK_DEVICE_PROFILE_ID?.trim();
        const applicationId = process.env.E2E_CHIRPSTACK_APPLICATION_ID?.trim();
        if (!chirpstackProfileId || !applicationId) {
          console.warn('[e2e] Defina E2E_CHIRPSTACK_DEVICE_PROFILE_ID y E2E_CHIRPSTACK_APPLICATION_ID.');
          return;
        }

        const suffix = Date.now().toString(36);
        const response = await authPost(app, accessToken, '/api/v1/device-profiles', {
          name: `E2E ChirpStack Create ${suffix}`,
          description: 'creado vía API',
          idChipstack: chirpstackProfileId,
          csApplicationId: applicationId,
          csJoineui: '1234568b9d55e072',
          csAppKey: 'd4e9f3b27a5c8160f8d2a1943eb7c65f',
          csNwkKey: '000000027a5c8160f8d2a1943eb7c65f',
          fccId: 'E2E-FCC',
          regions: 'US915',
          model: 'LW001',
        }).expect(201);

        expect(response.body.name).toBe(`E2E ChirpStack Create ${suffix}`);
        createdProfileIds.push(response.body.id);
      },
    );
  });
});
