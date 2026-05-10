import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import { getE2eSessionContext, hasE2eAuthConfigured } from '../helpers/e2e-auth';
import { CattleAgeHistory } from 'src/modules/farm/entities/cattle-age-history.entity';
import { BirthDateAprxSource } from 'src/modules/farm/enums/birth-date-aprx-source.enum';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;
const e2eAuthSuiteLabel = e2eAuthReady
  ? 'Integración dentición + cattle_age_history (E2E)'
  : 'Dentición / historial edad — omitido: credenciales test/.env.e2e';

/** Lee `date` de PostgreSQL como texto yyyy-MM-dd. */
async function pgDateText(
  ds: DataSource,
  sql: string,
  params: unknown[],
): Promise<string | null> {
  const rows = await ds.query(sql, params);
  const v = rows[0]?.d;
  return v == null ? null : String(v).trim().slice(0, 10);
}

/** Tabla SAPA (8 leche, 0 perm., desgastes 3/2) → 365 días; PG vs UTC pueden diferir ±1 día en bordes. */
async function assertDentitionAgeDaysApprox(
  ds: DataSource,
  cattleId: string,
  expectedDays: number,
): Promise<void> {
  const [{ diff }] = await ds.query(
    `SELECT (dental_evaluation_date - birth_date_aprx)::integer AS diff FROM cattle WHERE id = $1`,
    [cattleId],
  );
  expect(typeof diff).toBe('number');
  expect(diff).toBeGreaterThanOrEqual(expectedDays - 1);
  expect(diff).toBeLessThanOrEqual(expectedDays + 1);
}

/** Fecha de nacimiento en `cattle` = resultado en historial (trazabilidad). */
async function assertCattleBirthMatchesHistoryResult(
  ds: DataSource,
  cattleId: string,
  historyId: string,
): Promise<void> {
  const [{ ok }] = await ds.query(
    `SELECT (c.birth_date_aprx IS NOT DISTINCT FROM h.birth_date_aprx_result) AS ok
     FROM cattle c
     JOIN cattle_age_history h ON h.id = $2 AND h.id_cattle = c.id
     WHERE c.id = $1`,
    [cattleId, historyId],
  );
  expect(ok).toBe(true);
}

describe('Farm / cattle — dentición e historial de edad (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createE2eApplication();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/v1/cattle/:id sin Bearer responde 401', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/cattle/${'00000000-0000-4000-8000-000000000001'}`)
      .expect(401);
  });

  describeE2eAuth(e2eAuthSuiteLabel, () => {
    async function historyRows(idTenant: string, idCattle: string): Promise<CattleAgeHistory[]> {
      return dataSource.getRepository(CattleAgeHistory).find({
        where: { idTenant, idCattle },
        order: { createdAt: 'ASC' },
      });
    }

    function baseCreateBody(suffix: string) {
      return {
        sysNumber: suffix,
        number: suffix,
        receivedAt: '2025-01-15',
        receivedWeight: 350,
        purchaseWeight: 340,
        purchasePrice: 10000,
        lastWeight: 350,
      };
    }

    it('POST crear con dentición completa: birthDateAprx, origen DENTITION y fila en cattle_age_history', async () => {
      const { accessToken, tenantId } = await getE2eSessionContext(app);
      const suffix = `dent-full-${Date.now()}`;
      const dentalEvaluationDate = '2024-06-15';
      const createBody = {
        ...baseCreateBody(suffix),
        milkTeethCount: 8,
        permanentTeethCount: 0,
        milkTeethWear: 3,
        permanentTeethWear: 0,
        dentalEvaluationDate,
      };

      const created = await request(app.getHttpServer())
        .post('/api/v1/cattle')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createBody);

      expect(created.status).toBe(201);
      const cattleId = created.body?.id as string;
      expect(cattleId).toBeDefined();

      expect(created.body.birthDateAprxSource).toBe(BirthDateAprxSource.DENTITION);
      expect(created.body.milkTeethCount).toBe(8);
      expect(created.body.permanentTeethCount).toBe(0);
      expect(created.body.milkTeethWear).toBe(3);
      expect(created.body.permanentTeethWear).toBe(0);

      await assertDentitionAgeDaysApprox(dataSource, cattleId, 365);

      const rows = await historyRows(tenantId, cattleId);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const last = rows[rows.length - 1];
      expect(last.source).toBe(BirthDateAprxSource.DENTITION);
      expect(last.milkTeethCount).toBe(8);
      expect(last.permanentTeethCount).toBe(0);
      expect(last.milkWear).toBe(3);
      expect(last.permanentWear).toBe(0);

      await assertCattleBirthMatchesHistoryResult(dataSource, cattleId, last.id);

      const histEval = await pgDateText(
        dataSource,
        `SELECT dental_evaluation_date::text AS d FROM cattle_age_history WHERE id = $1`,
        [last.id],
      );
      expect(histEval).toBeTruthy();
      expect(last.dentitionTableVersion).toBeTruthy();
    });

    it('POST crear solo birthDateAprx manual: origen MANUAL e historial', async () => {
      const { accessToken, tenantId, userId } = await getE2eSessionContext(app);
      const suffix = `dent-man-${Date.now()}`;
      const birthDateAprx = '2019-03-20';
      const created = await request(app.getHttpServer())
        .post('/api/v1/cattle')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...baseCreateBody(suffix),
          birthDateAprx,
        });

      expect(created.status).toBe(201);
      const cattleId = created.body.id as string;

      expect(created.body.birthDateAprxSource).toBe(BirthDateAprxSource.MANUAL);

      const rows = await historyRows(tenantId, cattleId);
      expect(rows.length).toBe(1);
      expect(rows[0].source).toBe(BirthDateAprxSource.MANUAL);
      expect(rows[0].recordedBy).toBe(userId);
      const birthDb = await pgDateText(
        dataSource,
        `SELECT birth_date_aprx::text AS d FROM cattle WHERE id = $1`,
        [cattleId],
      );
      const histBirth = await pgDateText(
        dataSource,
        `SELECT birth_date_aprx_result::text AS d FROM cattle_age_history WHERE id = $1`,
        [rows[0].id],
      );
      expect(birthDb).toBe(histBirth);
      expect(rows[0].milkTeethCount).toBeNull();
    });

    it('POST crear con dentición parcial responde 400 DENTITION_PARTIAL_FIELDS', async () => {
      const { accessToken } = await getE2eSessionContext(app);
      const suffix = `dent-part-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/cattle')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...baseCreateBody(suffix),
          milkTeethCount: 8,
        });

      expect(res.status).toBe(400);
      const msg = res.body?.message;
      const flat = Array.isArray(msg) ? msg.join(' ') : String(msg ?? '');
      expect(flat).toContain('DENTITION_PARTIAL_FIELDS');
    });

    it('POST crear con leche>0 y desgaste leche 0 responde 400 DENTITION_WEAR_NA_WITH_PRESENT_MILK_TEETH', async () => {
      const { accessToken } = await getE2eSessionContext(app);
      const suffix = `dent-wear0-milk-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/cattle')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...baseCreateBody(suffix),
          milkTeethCount: 8,
          permanentTeethCount: 0,
          milkTeethWear: 0,
          permanentTeethWear: 0,
          dentalEvaluationDate: '2024-06-15',
        });

      expect(res.status).toBe(400);
      const msg = res.body?.message;
      const flat = Array.isArray(msg) ? msg.join(' ') : String(msg ?? '');
      expect(flat).toContain('DENTITION_WEAR_NA_WITH_PRESENT_MILK_TEETH');
    });

    it('POST crear con 0 permanentes y desgaste perm ≠ 0 responde 400 DENTITION_PERM_WEAR_MUST_BE_NA_WHEN_NO_PERMANENT_TEETH', async () => {
      const { accessToken } = await getE2eSessionContext(app);
      const suffix = `dent-perm-na-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/cattle')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...baseCreateBody(suffix),
          milkTeethCount: 8,
          permanentTeethCount: 0,
          milkTeethWear: 3,
          permanentTeethWear: 2,
          dentalEvaluationDate: '2024-06-15',
        });

      expect(res.status).toBe(400);
      const msg = res.body?.message;
      const flat = Array.isArray(msg) ? msg.join(' ') : String(msg ?? '');
      expect(flat).toContain('DENTITION_PERM_WEAR_MUST_BE_NA_WHEN_NO_PERMANENT_TEETH');
    });

    it('POST crear con permanentes>0 y desgaste perm 0 responde 400 DENTITION_WEAR_NA_WITH_PRESENT_PERMANENT_TEETH', async () => {
      const { accessToken } = await getE2eSessionContext(app);
      const suffix = `dent-wear0-perm-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/cattle')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...baseCreateBody(suffix),
          milkTeethCount: 0,
          permanentTeethCount: 8,
          milkTeethWear: 0,
          permanentTeethWear: 0,
          dentalEvaluationDate: '2024-06-15',
        });

      expect(res.status).toBe(400);
      const msg = res.body?.message;
      const flat = Array.isArray(msg) ? msg.join(' ') : String(msg ?? '');
      expect(flat).toContain('DENTITION_WEAR_NA_WITH_PRESENT_PERMANENT_TEETH');
    });

    it('POST crear con dentición sin fila en tabla responde 400 DENTITION_NO_RULE_FOR_COUNTS', async () => {
      const { accessToken } = await getE2eSessionContext(app);
      const suffix = `dent-nomatch-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/cattle')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...baseCreateBody(suffix),
          milkTeethCount: 1,
          permanentTeethCount: 0,
          milkTeethWear: 1,
          permanentTeethWear: 0,
          dentalEvaluationDate: '2024-01-01',
        });

      expect(res.status).toBe(400);
      const msg = res.body?.message;
      const flat = Array.isArray(msg) ? msg.join(' ') : String(msg ?? '');
      expect(flat).toContain('DENTITION_NO_RULE_FOR_COUNTS');
    });

    it('PATCH solo birthDateAprx: MANUAL y nueva fila en cattle_age_history', async () => {
      const { accessToken, tenantId } = await getE2eSessionContext(app);
      const suffix = `dent-patch-m-${Date.now()}`;
      const created = await request(app.getHttpServer())
        .post('/api/v1/cattle')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(baseCreateBody(suffix));

      expect(created.status).toBe(201);
      const cattleId = created.body.id as string;

      const beforeCount = (await historyRows(tenantId, cattleId)).length;

      const patched = await request(app.getHttpServer())
        .patch(`/api/v1/cattle/${cattleId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ birthDateAprx: '2018-11-01' });

      expect(patched.status).toBe(200);
      expect(patched.body.birthDateAprxSource).toBe(BirthDateAprxSource.MANUAL);

      const after = await historyRows(tenantId, cattleId);
      expect(after.length).toBe(beforeCount + 1);
      const lastH = after[after.length - 1];
      expect(lastH.source).toBe(BirthDateAprxSource.MANUAL);
      const birthCattle = await pgDateText(
        dataSource,
        `SELECT birth_date_aprx::text AS d FROM cattle WHERE id = $1`,
        [cattleId],
      );
      const birthHist = await pgDateText(
        dataSource,
        `SELECT birth_date_aprx_result::text AS d FROM cattle_age_history WHERE id = $1`,
        [lastH.id],
      );
      expect(birthCattle).toBe(birthHist);
    });

    it('PATCH dentición completa: recalcula DENTITION y añade historial', async () => {
      const { accessToken, tenantId } = await getE2eSessionContext(app);
      const suffix = `dent-patch-d-${Date.now()}`;
      const created = await request(app.getHttpServer())
        .post('/api/v1/cattle')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(baseCreateBody(suffix));

      expect(created.status).toBe(201);
      const cattleId = created.body.id as string;
      const beforeCount = (await historyRows(tenantId, cattleId)).length;

      const dentalEvaluationDate = '2022-12-01';
      const patched = await request(app.getHttpServer())
        .patch(`/api/v1/cattle/${cattleId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          milkTeethCount: 8,
          permanentTeethCount: 0,
          milkTeethWear: 3,
          permanentTeethWear: 0,
          dentalEvaluationDate,
        });

      expect(patched.status).toBe(200);
      expect(patched.body.birthDateAprxSource).toBe(BirthDateAprxSource.DENTITION);

      await assertDentitionAgeDaysApprox(dataSource, cattleId, 365);

      const after = await historyRows(tenantId, cattleId);
      expect(after.length).toBe(beforeCount + 1);
      const last = after[after.length - 1];
      expect(last.source).toBe(BirthDateAprxSource.DENTITION);
      await assertCattleBirthMatchesHistoryResult(dataSource, cattleId, last.id);
    });

    it('PATCH solo un campo de dentición responde 400 DENTITION_PARTIAL_FIELDS', async () => {
      const { accessToken } = await getE2eSessionContext(app);
      const suffix = `dent-patch-part-${Date.now()}`;
      const created = await request(app.getHttpServer())
        .post('/api/v1/cattle')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(baseCreateBody(suffix));

      expect(created.status).toBe(201);
      const cattleId = created.body.id as string;

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/cattle/${cattleId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ milkTeethCount: 6 });

      expect(res.status).toBe(400);
      const msg = res.body?.message;
      const flat = Array.isArray(msg) ? msg.join(' ') : String(msg ?? '');
      expect(flat).toContain('DENTITION_PARTIAL_FIELDS');
    });
  });
});
