import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { SessionUser } from 'src/common/decorators/session-user.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { GeneralReportsService } from '../services/general-reports.service';
import { CattleOnFeedReportDto } from '../dto/cattle-on-feed-report.dto';
import { CattleByStatusReportDto } from '../dto/cattle-by-status-report.dto';
import { FarmAverageDailyGainReportDto } from '../dto/farm-average-daily-gain-report.dto';
import { GeneralReportsSummaryDto } from '../dto/general-reports-summary.dto';

@ApiTags('Reports — General')
@ApiBearerAuth('access-token')
@Controller('reports/general')
@UseGuards(JwtAuthGuard)
export class GeneralReportsController {
  constructor(private readonly generalReportsService: GeneralReportsService) {}

  @Get('cattle-on-feed')
  @ApiOperation({ summary: 'Reses en cuido vs inventario ACTIVE+SOLD' })
  @ApiResponse({ status: 200, type: CattleOnFeedReportDto })
  getCattleOnFeed(@SessionUser() sessionUser: SessionUserDto): Promise<CattleOnFeedReportDto> {
    return this.generalReportsService.getCattleOnFeedSummary(sessionUser.tenant_id);
  }

  @Get('cattle-by-status')
  @ApiOperation({ summary: 'Distribución de reses por estado' })
  @ApiResponse({ status: 200, type: CattleByStatusReportDto })
  getCattleByStatus(@SessionUser() sessionUser: SessionUserDto): Promise<CattleByStatusReportDto> {
    return this.generalReportsService.getCattleStatusDistribution(sessionUser.tenant_id);
  }

  @Get('farm-average-daily-gain')
  @ApiOperation({ summary: 'GMD promedio de finca (ACTIVE+SOLD)' })
  @ApiResponse({ status: 200, type: FarmAverageDailyGainReportDto })
  getFarmAverageDailyGain(
    @SessionUser() sessionUser: SessionUserDto,
  ): Promise<FarmAverageDailyGainReportDto> {
    return this.generalReportsService.getFarmAverageDailyGain(sessionUser.tenant_id);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumen de reportes generales (dashboard)' })
  @ApiResponse({ status: 200, type: GeneralReportsSummaryDto })
  getSummary(@SessionUser() sessionUser: SessionUserDto): Promise<GeneralReportsSummaryDto> {
    return this.generalReportsService.getGeneralReportsSummary(sessionUser.tenant_id);
  }
}
