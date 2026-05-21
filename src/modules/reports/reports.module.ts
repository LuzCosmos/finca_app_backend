import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cattle } from '../farm/entities/cattle.entity';
import { ConfigurationModule } from '../configurations/configuration.module';
import { GeneralReportsRepository } from './repositories/general-reports.repository';
import { GeneralReportsService } from './services/general-reports.service';
import { GeneralReportsController } from './controllers/general-reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cattle]), ConfigurationModule],
  controllers: [GeneralReportsController],
  providers: [GeneralReportsRepository, GeneralReportsService],
  exports: [GeneralReportsService],
})
export class ReportsModule {}
