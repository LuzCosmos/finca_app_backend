import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomBytes, randomUUID } from 'crypto';
import { DataSource, In } from 'typeorm';
import { Device } from '../../../src/modules/production-center/entities/device.entity';
import { DeviceProfile } from '../../../src/modules/production-center/entities/device-profile.entity';
import { ImportLw001Reason } from '../../../src/modules/production-center/import-lw001/import-lw001.constants';
import {
  buildLegacyImportFileBuffer,
  buildLw001ImportFileBuffer,
  buildLw001MultiSheetImportFileBuffer,
  Lw001ImportFileFormat,
} from '../../helpers/lw001-import-file.builder';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import {
  hasE2eAuthConfigured,
  hasE2eLimited403Configured,
  hasE2eLw001ImportChirpstackConfigured,
  hasE2eLw001ImportChirpstackPersistConfigured,
  isChirpstackReachableWithConfiguredKey,
  loginE2eLimitedViaPassword,
  loginE2eViaPassword,
} from '../helpers/e2e-auth';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;
const it403 = hasE2eAuthConfigured() && hasE2eLimited403Configured() ? it : it.skip;
const itChirpstackImport =
  hasE2eAuthConfigured() && hasE2eLw001ImportChirpstackConfigured() ? it : it.skip;
const itChirpstackPersistEnv =
  hasE2eAuthConfigured() && hasE2eLw001ImportChirpstackPersistConfigured() ? it : it.skip;

const VALID_FORMATS: Lw001ImportFileFormat[] = ['xlsx', 'xls', 'csv'];

function extractBadRequestMessage(body: { message?: string | string[] }): string {
  if (typeof body.message === 'string') {
    return body.message;
  }
  return body.message?.[0] ?? '';
}

function postImport(
  app: INestApplication<App>,
  accessToken: string,
  buffer: Buffer,
  filename: string,
  fields?: Record<string, string>,
): request.Test {
  const req = request(app.getHttpServer())
    .post('/api/v1/devices/import')
    .set('Authorization', `Bearer ${accessToken}`)
    .attach('file', buffer, filename);
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      req.field(key, value);
    }
  }
  return req;
}

describe('Production Center / devices import LW001 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createE2eApplication();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /api/v1/devices/import sin Bearer responde 401', () => {
    return request(app.getHttpServer())
      .post('/api/v1/devices/import')
      .expect(401);
  });

  it403('usuario limitado recibe 403', async () => {
    const { access_token } = await loginE2eLimitedViaPassword(app);
    const { buffer, filename } = buildLegacyImportFileBuffer('xlsx');
    await postImport(app, access_token, buffer, filename).expect(403);
  });

  describeE2eAuth('con autenticación', () => {
    let accessToken: string;
    let tenantProfileId: string;
    let rowColumnProfileId: string;
    let chirpstackTokenValid = false;
    const createdDeviceProfileIds: string[] = [];
    const createdDeviceDeveuis: string[] = [];

    beforeAll(async () => {
      const login = await loginE2eViaPassword(app);
      accessToken = login.access_token;

      const profileRepo = dataSource.getRepository(DeviceProfile);
      const chirpstackProfileId =
        process.env.E2E_CHIRPSTACK_DEVICE_PROFILE_ID?.trim() || randomUUID();
      const chirpstackApplicationId =
        process.env.E2E_CHIRPSTACK_APPLICATION_ID?.trim() || randomUUID();
      const hasChirpstackIdsFromEnv = !!(
        process.env.E2E_CHIRPSTACK_DEVICE_PROFILE_ID?.trim()
        && process.env.E2E_CHIRPSTACK_APPLICATION_ID?.trim()
      );

      const existingProfiles = await profileRepo.find({
        where: { idTenant: login.user.tenant_id },
        order: { name: 'ASC' },
        take: 2,
      });

      if (!hasChirpstackIdsFromEnv && existingProfiles.length >= 2) {
        tenantProfileId = existingProfiles[0].id;
        rowColumnProfileId = existingProfiles[1].id;
        return;
      }
      if (!hasChirpstackIdsFromEnv && existingProfiles.length === 1) {
        tenantProfileId = existingProfiles[0].id;
        rowColumnProfileId = existingProfiles[0].id;
        return;
      }

      const suffix = Date.now().toString(36);
      const defaultProfile = profileRepo.create({
        idTenant: login.user.tenant_id,
        name: `E2E LW001 Import default ${suffix}`,
        description: 'E2E import LW001 dropdown',
        idChipstack: chirpstackProfileId,
        csApplicationId: chirpstackApplicationId,
        csJoineui: '0000000000000001',
        csAppKey: 'a'.repeat(32),
        csNwkKey: 'b'.repeat(32),
        fccId: 'E2E-FCC',
        regions: 'US915',
        model: 'E2E',
      });
      const rowProfile = profileRepo.create({
        idTenant: login.user.tenant_id,
        name: `E2E LW001 Import row ${suffix}`,
        description: 'E2E import LW001 column B',
        idChipstack: chirpstackProfileId,
        csApplicationId: chirpstackApplicationId,
        csJoineui: '2222222222222222',
        csAppKey: 'c'.repeat(32),
        csNwkKey: 'd'.repeat(32),
        fccId: 'E2E-FCC',
        regions: 'US915',
        model: 'E2E',
      });
      await profileRepo.save([defaultProfile, rowProfile]);
      tenantProfileId = defaultProfile.id;
      rowColumnProfileId = rowProfile.id;
      createdDeviceProfileIds.push(defaultProfile.id, rowProfile.id);
    });

    beforeAll(async () => {
      if (hasE2eLw001ImportChirpstackPersistConfigured()) {
        chirpstackTokenValid = await isChirpstackReachableWithConfiguredKey();
        if (!chirpstackTokenValid) {
          console.warn(
            '[e2e] ChirpStack: token rechazado o host inaccesible. ' +
              'Revise que test/.env.e2e tenga un único CHIRPSTACK_API_KEY (JWT válido, sin duplicados).',
          );
        }
      }
    });

    afterAll(async () => {
      if (createdDeviceDeveuis.length) {
        await dataSource.getRepository(Device).delete({ deveui: In(createdDeviceDeveuis) });
      }
      if (createdDeviceProfileIds.length) {
        await dataSource.getRepository(DeviceProfile).delete(createdDeviceProfileIds);
      }
    });

    describe.each(VALID_FORMATS)('formato .%s — rechazo global', (format) => {
      it('rechaza plantilla legacy con IMPORT_HEADERS_INVALID', async () => {
        const { buffer, filename } = buildLegacyImportFileBuffer(format);
        const response = await postImport(app, accessToken, buffer, filename).expect(400);
        expect(extractBadRequestMessage(response.body)).toBe(
          ImportLw001Reason.IMPORT_HEADERS_INVALID,
        );
      });

      it('rechaza cabecera permutada con IMPORT_HEADERS_INVALID', async () => {
        const { buffer, filename } = buildLw001ImportFileBuffer(
          [['0102030405060708', '', '', '']],
          format,
          {
            headerRow: ['idDeviceProfile', 'devEui', 'joineui', 'appKey'],
          },
        );
        const response = await postImport(app, accessToken, buffer, filename).expect(400);
        expect(extractBadRequestMessage(response.body)).toBe(
          ImportLw001Reason.IMPORT_HEADERS_INVALID,
        );
      });

      it('rechaza archivo solo con cabecera (FILE_EMPTY)', async () => {
        const { buffer, filename } = buildLw001ImportFileBuffer([], format);
        const response = await postImport(app, accessToken, buffer, filename).expect(400);
        expect(extractBadRequestMessage(response.body)).toBe(ImportLw001Reason.FILE_EMPTY);
      });

      it('rechaza sin deviceProfileId cuando fila sin columna B', async () => {
        const { buffer, filename } = buildLw001ImportFileBuffer(
          [['0102030405060708', '', '', '']],
          format,
        );
        const response = await postImport(app, accessToken, buffer, filename).expect(400);
        expect(extractBadRequestMessage(response.body)).toBe(
          ImportLw001Reason.DEVICE_PROFILE_ID_REQUIRED,
        );
      });
    });

    describe.each(VALID_FORMATS)('formato .%s — importación parcial (HTTP 200)', (format) => {
      it('devuelve DEVEUI_INVALID_LENGTH en errors[]', async () => {
        const { buffer, filename } = buildLw001ImportFileBuffer([['0102', '', '', '']], format);
        const response = await postImport(app, accessToken, buffer, filename, {
          deviceProfileId: tenantProfileId,
        }).expect(200);

        expect(response.body.totalRows).toBe(1);
        expect(response.body.created).toBe(0);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              reason: ImportLw001Reason.DEVEUI_INVALID_LENGTH,
              row: 2,
            }),
          ]),
        );
      });

      it('devuelve DEVICE_PROFILE_ID_INVALID cuando columna B no es UUID del tenant', async () => {
        const unknownProfileId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
        const { buffer, filename } = buildLw001ImportFileBuffer(
          [['0102030405060708', unknownProfileId, '', '']],
          format,
        );
        const response = await postImport(app, accessToken, buffer, filename).expect(200);

        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              reason: ImportLw001Reason.DEVICE_PROFILE_ID_INVALID,
            }),
          ]),
        );
      });

      it('devuelve APP_KEY_SCIENTIFIC_NOTATION cuando AppKey viene en notación científica', async () => {
        const { buffer, filename } = buildLw001ImportFileBuffer(
          [['0102030405060708', '', '', '1.23E+32']],
          format,
          {
            headerRow: ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
          },
        );
        const response = await postImport(app, accessToken, buffer, filename, {
          deviceProfileId: tenantProfileId,
        }).expect(200);

        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              reason: ImportLw001Reason.APP_KEY_SCIENTIFIC_NOTATION,
            }),
          ]),
        );
      });
    });

    it('importa filas de todas las hojas .xlsx con cabecera LW001 en cada una', async () => {
      const deveuiA = randomBytes(8).toString('hex');
      const deveuiB = randomBytes(8).toString('hex');
      const { buffer, filename } = buildLw001MultiSheetImportFileBuffer([
        { name: 'Hoja1', dataRows: [[deveuiA, '', '', '']] },
        { name: 'Hoja2', dataRows: [[deveuiB, '', '', '']] },
      ]);
      const response = await postImport(app, accessToken, buffer, filename, {
        deviceProfileId: tenantProfileId,
      }).expect(200);

      expect(response.body.totalRows).toBe(2);
      const invalidDeveuiErrors = (response.body.errors ?? []).filter(
        (e: { reason: string }) => e.reason === ImportLw001Reason.DEVEUI_INVALID_LENGTH,
      );
      expect(invalidDeveuiErrors).toHaveLength(0);
      if ((response.body.created ?? 0) > 0) {
        createdDeviceDeveuis.push(deveuiA.toLowerCase(), deveuiB.toLowerCase());
      }
    });

    itChirpstackImport(
      'hereda joineui/appKey del perfil de columna B sin errores de validación de claves',
      async () => {
        const deveui = randomBytes(8).toString('hex');
        const { buffer, filename } = buildLw001ImportFileBuffer(
          [[deveui, rowColumnProfileId, '', '']],
          'xlsx',
        );
        const response = await postImport(app, accessToken, buffer, filename, {
          deviceProfileId: tenantProfileId,
        }).expect(200);

        const reasons = [
          ...(response.body.errors ?? []).map((e: { reason: string }) => e.reason),
          ...(response.body.warnings ?? []).map((w: { reason: string }) => w.reason),
        ];
        expect(reasons).not.toContain(ImportLw001Reason.JOINEUI_INVALID);
        expect(reasons).not.toContain(ImportLw001Reason.APP_KEY_INVALID);
        expect(reasons).not.toContain(ImportLw001Reason.DEVICE_PROFILE_ID_REQUIRED);
        if ((response.body.created ?? 0) > 0) {
          createdDeviceDeveuis.push(deveui.toLowerCase());
        }
      },
    );

    itChirpstackPersistEnv(
      'persiste dispositivo importado en ChirpStack (IDs reales en .env.e2e)',
      async () => {
        expect(chirpstackTokenValid).toBe(true);
        const deveui = randomBytes(8).toString('hex');
        const { buffer, filename } = buildLw001ImportFileBuffer(
          [[deveui, rowColumnProfileId, '', '']],
          'xlsx',
        );
        const response = await postImport(app, accessToken, buffer, filename, {
          deviceProfileId: tenantProfileId,
        }).expect(200);

        expect(response.body.created + response.body.updated).toBeGreaterThanOrEqual(1);
        expect(response.body.errors ?? []).toHaveLength(0);
        if (response.body.created > 0) {
          createdDeviceDeveuis.push(deveui.toLowerCase());
        }
      },
    );

    it('rechaza extensión no soportada (.txt) con 400 UNSUPPORTED_FILE_FORMAT', async () => {
      const buffer = Buffer.from('devEui,idDeviceProfile,joineui,appKey\n', 'utf8');
      const response = await postImport(app, accessToken, buffer, 'import.txt').expect(400);
      expect(extractBadRequestMessage(response.body)).toBe(
        ImportLw001Reason.UNSUPPORTED_FILE_FORMAT,
      );
    });
  });
});
