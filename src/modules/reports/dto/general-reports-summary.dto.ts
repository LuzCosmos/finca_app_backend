import { ApiProperty } from '@nestjs/swagger';
import { CattleOnFeedReportDto } from './cattle-on-feed-report.dto';
import { CattleByStatusReportDto } from './cattle-by-status-report.dto';
import { FarmAverageDailyGainReportDto } from './farm-average-daily-gain-report.dto';

export class GeneralReportsSummaryDto {
  @ApiProperty({ type: CattleOnFeedReportDto })
  cattleOnFeed: CattleOnFeedReportDto;

  @ApiProperty({ type: CattleByStatusReportDto })
  cattleByStatus: CattleByStatusReportDto;

  @ApiProperty({ type: FarmAverageDailyGainReportDto })
  farmAverageDailyGain: FarmAverageDailyGainReportDto;
}
