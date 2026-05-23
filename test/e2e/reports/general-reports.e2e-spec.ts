import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createE2eApplication } from '../helpers/e2e-bootstrap';
import {
  hasE2eAuthConfigured,
  hasE2eFarmWorker403Configured,
  loginE2eFarmWorkerViaPassword,
  loginE2eViaPassword,
} from '../helpers/e2e-auth';
import { Cattle, CattleStatus } from '../../../src/modules/farm/entities/cattle.entity';
import { CattleGender } from '../../../src/modules/farm/enums/cattle-gender.enum';
import { Configuration } from '../../../src/modules/configurations/entities/configuration.entity';

const e2eAuthReady = hasE2eAuthConfigured();
const describeE2eAuth = e2eAuthReady ? describe : describe.skip;
const e2eFarmWorkerReady = hasE2eFarmWorker403Configured();
const itFarmWorker = e2eFarmWorkerReady ? it : it.skip;

const REPORT_PATHS = {
  onFeed: '/api/v1/reports/general/cattle-on-feed',
  byStatus: '/api/v1/reports/general/cattle-by-status',
  adg: '/api/v1/reports/general/farm-average-daily-gain',
  summary: '/api/v1/reports/general/summary',
} as const;

function createCattlePayload(
  tenantId: string,
  suffix: string,
  status: CattleStatus,
  opts?: { onFeed?: boolean; averageDailyGain?: number | null },
): Partial<Cattle> {
  return {
    idTenant: tenantId,
    sysNumber: `RPT-SYS-${suffix}`,
    number: `RPT-${suffix}`,
    receivedAt: new Date('2026-01-01'),
    receivedWeight: 300,
    purchaseWeight: 300,
    purchasePrice: 1000,
    purchasedFrom: 'E2E-REPORTS',
    gender: CattleGender.MALE,
    status,
    newFeedStartDate: opts?.onFeed ? new Date('2026-03-01') : null,
    averageDailyGain: opts?.averageDailyGain ?? null,
  };
}

describe('Reports general — auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApplication();
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each(Object.values(REPORT_PATHS))('GET %s sin Bearer responde 401', (path) => {
    return request(app.getHttpServer()).get(path).expect(401);
  });
});

describeE2eAuth('Reports general — métricas y summary (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let token: string;
  let tenantId: string;

  const createdCattleIds: string[] = [];
  let savedAdgConfig: Configuration | null = null;
  let previousAdgValue: string | null = null;

  beforeAll(async () => {
    app = await createE2eApplication();
    dataSource = app.get(DataSource);
    const login = await loginE2eViaPassword(app);
    token = login.access_token;
    tenantId = login.user.tenant_id;
  });

  afterAll(async () => {
    try {
      if (dataSource) {
        if (createdCattleIds.length) {
          await dataSource.getRepository(Cattle).delete(createdCattleIds);
        }
        const configRepo = dataSource.getRepository(Configuration);
        if (savedAdgConfig) {
          if (previousAdgValue != null) {
            savedAdgConfig.value = previousAdgValue;
            await configRepo.save(savedAdgConfig);
          } else {
            await configRepo.delete(savedAdgConfig.id);
          }
        }
      }
    } finally {
      await app?.close();
    }
  });

  async function authGet(path: string) {
    return request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);
  }

  it('cattle-on-feed: DEAD con new_feed_start_date no incrementa onFeedCount', async () => {
    const before = await authGet(REPORT_PATHS.onFeed);
    expect(before.status).toBe(200);

    const cattleRepo = dataSource.getRepository(Cattle);
    const deadOnFeed = cattleRepo.create(
      createCattlePayload(tenantId, `dead-feed-${Date.now()}`, CattleStatus.DEAD, {
        onFeed: true,
      }) as Cattle,
    );
    await cattleRepo.save(deadOnFeed);
    createdCattleIds.push(deadOnFeed.id);

    const after = await authGet(REPORT_PATHS.onFeed);
    expect(after.status).toBe(200);
    expect(after.body.onFeedCount).toBe(before.body.onFeedCount);

    const activeOnFeed = cattleRepo.create(
      createCattlePayload(tenantId, `active-feed-${Date.now()}`, CattleStatus.ACTIVE, {
        onFeed: true,
      }) as Cattle,
    );
    await cattleRepo.save(activeOnFeed);
    createdCattleIds.push(activeOnFeed.id);

    const afterActive = await authGet(REPORT_PATHS.onFeed);
    expect(afterActive.status).toBe(200);
    expect(afterActive.body.onFeedCount).toBe(before.body.onFeedCount + 1);
  });

  it('cattle-by-status incluye desglose ACTIVE, SOLD, DEAD, LOST', async () => {
    const res = await authGet(REPORT_PATHS.byStatus);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalCount: expect.any(Number),
      byStatus: {
        ACTIVE: expect.any(Number),
        SOLD: expect.any(Number),
        DEAD: expect.any(Number),
        LOST: expect.any(Number),
      },
    });
    const sum =
      res.body.byStatus.ACTIVE +
      res.body.byStatus.SOLD +
      res.body.byStatus.DEAD +
      res.body.byStatus.LOST;
    expect(res.body.totalCount).toBe(sum);
  });

  it('farm-average-daily-gain y summary comparten bloque GMD (paridad CA-08c)', async () => {
    const configRepo = dataSource.getRepository(Configuration);
    savedAdgConfig = await configRepo.findOne({
      where: { idTenant: tenantId, code: 'average_daily_gain' },
    });
    if (savedAdgConfig) {
      previousAdgValue = savedAdgConfig.value;
      savedAdgConfig.value = '0.5';
      await configRepo.save(savedAdgConfig);
    } else {
      savedAdgConfig = configRepo.create({
        idTenant: tenantId,
        code: 'average_daily_gain',
        isSystemConfig: true,
        name: 'Average Daily Gain',
        description: 'E2E',
        value: '0.5',
        valueType: 'number',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await configRepo.save(savedAdgConfig);
      previousAdgValue = null;
    }

    const cattleRepo = dataSource.getRepository(Cattle);
    const ts = Date.now();
    const rows = [
      cattleRepo.create(
        createCattlePayload(tenantId, `adg-a-${ts}`, CattleStatus.ACTIVE, {
          averageDailyGain: null,
        }) as Cattle,
      ),
      cattleRepo.create(
        createCattlePayload(tenantId, `adg-b-${ts}`, CattleStatus.ACTIVE, {
          averageDailyGain: null,
        }) as Cattle,
      ),
      cattleRepo.create(
        createCattlePayload(tenantId, `adg-c-${ts}`, CattleStatus.SOLD, {
          averageDailyGain: 1.2,
        }) as Cattle,
      ),
    ];
    await cattleRepo.save(rows);
    createdCattleIds.push(...rows.map((r) => r.id));

    const adgRes = await authGet(REPORT_PATHS.adg);
    const summaryRes = await authGet(REPORT_PATHS.summary);

    expect(adgRes.status).toBe(200);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.farmAverageDailyGain).toEqual(adgRes.body);
    expect(adgRes.body.hasData).toBe(true);
    expect(typeof adgRes.body.farmAverageDailyGainKg).toBe('number');
  });

  it('summary agrupa cattleOnFeed, cattleByStatus y farmAverageDailyGain', async () => {
    const [summary, onFeed, byStatus, adg] = await Promise.all([
      authGet(REPORT_PATHS.summary),
      authGet(REPORT_PATHS.onFeed),
      authGet(REPORT_PATHS.byStatus),
      authGet(REPORT_PATHS.adg),
    ]);

    expect(summary.status).toBe(200);
    expect(onFeed.status).toBe(200);
    expect(byStatus.status).toBe(200);
    expect(adg.status).toBe(200);

    expect(summary.body.cattleOnFeed).toEqual(onFeed.body);
    expect(summary.body.cattleByStatus).toEqual(byStatus.body);
    expect(summary.body.farmAverageDailyGain).toEqual(adg.body);
  });

  itFarmWorker('FARM_WORKER obtiene 200 en los cuatro endpoints', async () => {
    const { access_token } = await loginE2eFarmWorkerViaPassword(app);

    for (const path of Object.values(REPORT_PATHS)) {
      const res = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${access_token}`);
      expect(res.status).toBe(200);
    }
  });
});
