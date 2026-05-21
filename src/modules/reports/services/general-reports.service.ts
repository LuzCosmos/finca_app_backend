import { Injectable } from '@nestjs/common';
import { CattleStatus } from '../../farm/entities/cattle.entity';
import { ConfigurationsService } from '../../configurations/services/configurations.service';
import { GeneralReportsRepository } from '../repositories/general-reports.repository';
import { CattleOnFeedReportDto } from '../dto/cattle-on-feed-report.dto';
import { CattleByStatusReportDto } from '../dto/cattle-by-status-report.dto';
import { FarmAverageDailyGainReportDto } from '../dto/farm-average-daily-gain-report.dto';
import { GeneralReportsSummaryDto } from '../dto/general-reports-summary.dto';
import {
  parseTenantAverageDailyGain,
  resolveGainEfectivoKg,
  roundFarmAverageDailyGainKg,
} from '../utils/general-reports-gain.util';

@Injectable()
export class GeneralReportsService {
  constructor(
    private readonly generalReportsRepository: GeneralReportsRepository,
    private readonly configurationsService: ConfigurationsService,
  ) {}

  async getCattleOnFeedSummary(idTenant: string): Promise<CattleOnFeedReportDto> {
    const [activeCount, soldCount, onFeedCount] = await Promise.all([
      this.generalReportsRepository.countByStatus(idTenant, CattleStatus.ACTIVE),
      this.generalReportsRepository.countByStatus(idTenant, CattleStatus.SOLD),
      this.generalReportsRepository.countOnFeedActiveSold(idTenant),
    ]);

    return {
      onFeedCount,
      activeCount,
      soldCount,
      activeAndSoldTotal: activeCount + soldCount,
    };
  }

  async getCattleStatusDistribution(idTenant: string): Promise<CattleByStatusReportDto> {
    const [active, sold, dead, lost] = await Promise.all([
      this.generalReportsRepository.countByStatus(idTenant, CattleStatus.ACTIVE),
      this.generalReportsRepository.countByStatus(idTenant, CattleStatus.SOLD),
      this.generalReportsRepository.countByStatus(idTenant, CattleStatus.DEAD),
      this.generalReportsRepository.countByStatus(idTenant, CattleStatus.LOST),
    ]);

    const byStatus = {
      ACTIVE: active,
      SOLD: sold,
      DEAD: dead,
      LOST: lost,
    };

    return {
      totalCount: active + sold + dead + lost,
      byStatus,
    };
  }

  async getFarmAverageDailyGain(idTenant: string): Promise<FarmAverageDailyGainReportDto> {
    const tenantConfig = await this.configurationsService.getTenantConfiguration(
      idTenant,
      'average_daily_gain',
    );
    const tenantFallbackKg = parseTenantAverageDailyGain(tenantConfig?.value);
    const hasTenantConfig = tenantFallbackKg != null;

    const rows = await this.generalReportsRepository.findActiveSoldAdgRows(idTenant);
    const effectiveGains: number[] = [];

    for (const row of rows) {
      const gain = resolveGainEfectivoKg(row.averageDailyGain, tenantFallbackKg);
      if (gain != null) {
        effectiveGains.push(gain);
      } else if (!hasTenantConfig) {
        continue;
      }
    }

    if (effectiveGains.length === 0) {
      return { farmAverageDailyGainKg: null, hasData: false };
    }

    const sum = effectiveGains.reduce((acc, v) => acc + v, 0);
    const average = roundFarmAverageDailyGainKg(sum / effectiveGains.length);

    return {
      farmAverageDailyGainKg: average,
      hasData: true,
    };
  }

  async getGeneralReportsSummary(idTenant: string): Promise<GeneralReportsSummaryDto> {
    const [cattleOnFeed, cattleByStatus, farmAverageDailyGain] = await Promise.all([
      this.getCattleOnFeedSummary(idTenant),
      this.getCattleStatusDistribution(idTenant),
      this.getFarmAverageDailyGain(idTenant),
    ]);

    return {
      cattleOnFeed,
      cattleByStatus,
      farmAverageDailyGain,
    };
  }
}
