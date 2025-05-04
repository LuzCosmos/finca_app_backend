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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cattle, 
      CattleDeviceAssignment,
    ]),
    ConfigModule,
    ApplicationPermissionsModule,
    ProductionCenterModule
  ],
  providers: [
    CattleRepository,
    CattleService,
    CattleDeviceAssignmentRepository,
  ],
  controllers: [
    CattleController,
  ],
  exports: [
    CattleService,
  ],
})
export class FarmModule {} 