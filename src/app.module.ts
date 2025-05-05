import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeManagementModule } from './modules/employee-management/employee-management.module';
import { AuthModule } from './modules/auth/auth.module';
import { typeOrmConfig } from './config/typeorm.config';
import { ProductionCenterModule } from './modules/production-center/production-center.module';
import { FarmModule } from './modules/farm/farm.module';
import { MqttModule } from './modules/mqtt/mqtt.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(typeOrmConfig),
    AuthModule,
    EmployeeManagementModule,
    ProductionCenterModule,
    FarmModule,
    MqttModule
  ],
})
export class AppModule {}
