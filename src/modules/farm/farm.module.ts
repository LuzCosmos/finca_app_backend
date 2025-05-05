import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cattle } from './entities/cattle.entity';
import { CattleRepository } from './repositories/cattle.repository';
import { CattleService } from './services/cattle.service';
import { CattleController } from './controllers/cattle.controller';
import { ConfigModule } from '@nestjs/config';
import { ApplicationPermissionsModule } from '../auth/application-permissions/application-permissions.module';
import { CattleDeviceAssignment } from './entities/cattleDeviceAssignment.entity';
import { CattleDeviceAssignmentRepository } from './repositories/cattleDeviceAssignment.repository';
import { ProductionCenterModule } from '../production-center/production-center.module';
import { Location } from './entities/location.entity';
import { LocationService } from './services/location.service';
import { LocationRepository } from './repositories/location.repository';
import { LocationController } from './controllers/location.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cattle, 
      CattleDeviceAssignment,
      Location
    ]),
    ConfigModule,
    ApplicationPermissionsModule,
    ProductionCenterModule
  ],
  providers: [
    CattleRepository,
    CattleService,
    CattleDeviceAssignmentRepository,
    LocationService,
    LocationRepository
  ],
  controllers: [
    CattleController,
    LocationController
  ],
  exports: [
    CattleService,
    LocationService
  ],
})
export class FarmModule {} 