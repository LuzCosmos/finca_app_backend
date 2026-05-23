import { Test, TestingModule } from '@nestjs/testing';
import { GeneralReportsService } from './general-reports.service';
import { GeneralReportsRepository } from '../repositories/general-reports.repository';
import { ConfigurationsService } from '../../configurations/services/configurations.service';
import { CattleStatus } from '../../farm/entities/cattle.entity';

describe('GeneralReportsService', () => {
  let service: GeneralReportsService;
  let repository: {
    countByStatus: jest.Mock;
    countOnFeedActiveSold: jest.Mock;
    findActiveSoldAdgRows: jest.Mock;
  };
  let configurationsService: { getTenantConfiguration: jest.Mock };

  beforeEach(async () => {
    repository = {
      countByStatus: jest.fn(),
      countOnFeedActiveSold: jest.fn(),
      findActiveSoldAdgRows: jest.fn(),
    };
    configurationsService = { getTenantConfiguration: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneralReportsService,
        { provide: GeneralReportsRepository, useValue: repository },
        { provide: ConfigurationsService, useValue: configurationsService },
      ],
    }).compile();

    service = module.get(GeneralReportsService);
  });

  it('getCattleOnFeedSummary agrega conteos ACTIVE, SOLD y en cuido', async () => {
    repository.countByStatus.mockImplementation((_tenant: string, status: CattleStatus) => {
      if (status === CattleStatus.ACTIVE) return Promise.resolve(10);
      if (status === CattleStatus.SOLD) return Promise.resolve(5);
      return Promise.resolve(0);
    });
    repository.countOnFeedActiveSold.mockResolvedValue(3);

    const result = await service.getCattleOnFeedSummary('tenant-1');

    expect(result).toEqual({
      onFeedCount: 3,
      activeCount: 10,
      soldCount: 5,
      activeAndSoldTotal: 15,
    });
  });

  it('getFarmAverageDailyGain con config tenant promedia todas las reses ACTIVE+SOLD', async () => {
    configurationsService.getTenantConfiguration.mockResolvedValue({ value: '0.5' });
    repository.findActiveSoldAdgRows.mockResolvedValue([
      { averageDailyGain: null },
      { averageDailyGain: null },
      { averageDailyGain: 1.2 },
    ]);

    const result = await service.getFarmAverageDailyGain('tenant-1');

    expect(result.hasData).toBe(true);
    expect(result.farmAverageDailyGainKg).toBeCloseTo(0.733, 3);
  });

  it('getFarmAverageDailyGain sin config solo usa reses con ADG propio', async () => {
    configurationsService.getTenantConfiguration.mockResolvedValue(null);
    repository.findActiveSoldAdgRows.mockResolvedValue([
      { averageDailyGain: null },
      { averageDailyGain: 0.8 },
    ]);

    const result = await service.getFarmAverageDailyGain('tenant-1');

    expect(result).toEqual({ farmAverageDailyGainKg: 0.8, hasData: true });
  });

  it('getFarmAverageDailyGain sin datos retorna hasData false', async () => {
    configurationsService.getTenantConfiguration.mockResolvedValue(null);
    repository.findActiveSoldAdgRows.mockResolvedValue([
      { averageDailyGain: null },
      { averageDailyGain: 0 },
    ]);

    const result = await service.getFarmAverageDailyGain('tenant-1');

    expect(result).toEqual({ farmAverageDailyGainKg: null, hasData: false });
  });

  it('getGeneralReportsSummary delega en los tres métodos', async () => {
    const onFeed = { onFeedCount: 1, activeCount: 2, soldCount: 0, activeAndSoldTotal: 2 };
    const byStatus = {
      totalCount: 2,
      byStatus: { ACTIVE: 2, SOLD: 0, DEAD: 0, LOST: 0 },
    };
    const adg = { farmAverageDailyGainKg: 0.5, hasData: true };

    jest.spyOn(service, 'getCattleOnFeedSummary').mockResolvedValue(onFeed);
    jest.spyOn(service, 'getCattleStatusDistribution').mockResolvedValue(byStatus);
    jest.spyOn(service, 'getFarmAverageDailyGain').mockResolvedValue(adg);

    const result = await service.getGeneralReportsSummary('tenant-1');

    expect(result).toEqual({
      cattleOnFeed: onFeed,
      cattleByStatus: byStatus,
      farmAverageDailyGain: adg,
    });
  });
});
