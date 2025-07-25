import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cattle } from './entities/cattle.entity';
import { CattleRepository } from './repositories/cattle.repository';
import { CattleService } from './services/cattle.service';
import { CattleController } from './controllers/cattle.controller';
import { ConfigModule } from '@nestjs/config';
import { ApplicationPermissionsModule } from '../../common/application-permissions/application-permissions.module';
import { CattleDeviceHistory } from './entities/cattle-device-history.entity';
import { CattleDeviceHistoryRepository } from './repositories/cattle-device-history.repository';
import { CattleWeightHistory } from './entities/cattle-weight-history.entity';
import { CattleWeightHistoryRepository } from './repositories/cattle-weight-history.repository';
import { CattleEartagHistory } from './entities/cattle-eartag-history.entity';
import { CattleEartagHistoryRepository } from './repositories/cattle-eartag-history.repository';
import { CattleMedicationHistory } from './entities/cattle-medication-history.entity';
import { CattleMedicationHistoryRepository } from './repositories/cattle-medication-history.repository';
import { ProductionCenterModule } from '../production-center/production-center.module';
import { Location } from './entities/location.entity';
import { LocationService } from './services/location.service';
import { LocationRepository } from './repositories/location.repository';
import { LocationController } from './controllers/location.controller';
import { MassiveEventsModule } from '../massive-events/massive-events.module';

@Module({
  imports: [
    forwardRef(() => MassiveEventsModule),
    TypeOrmModule.forFeature([
      Cattle, 
      CattleDeviceHistory,
      CattleWeightHistory,
      CattleEartagHistory,
      CattleMedicationHistory,
      Location
    ]),
    ConfigModule,
    ApplicationPermissionsModule,
    ProductionCenterModule
  ],
  providers: [
    CattleRepository,
    CattleService,
    CattleDeviceHistoryRepository,
    CattleWeightHistoryRepository,
    CattleEartagHistoryRepository,
    CattleMedicationHistoryRepository,
    LocationService,
    LocationRepository
  ],
  controllers: [
    CattleController,
    LocationController
  ],
  exports: [
    CattleService,
    LocationService,
    CattleRepository
  ],
})
export class FarmModule {} 