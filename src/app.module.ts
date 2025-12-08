import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeManagementModule } from 'src/modules/employee-management/employee-management.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { typeOrmConfig } from 'src/config/typeorm.config';
import { ProductionCenterModule } from 'src/modules/production-center/production-center.module';
import { FarmModule } from 'src/modules/farm/farm.module';
import { MqttModule } from 'src/modules/mqtt/mqtt.module';
import { CommerceModule } from 'src/modules/commerce/commerce.module';
import { join } from 'path';
import { ReceptionModule } from 'src/modules/purchase-receptions/reception.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvVars: true,
      envFilePath: [join(__dirname, '..', '.env')],
      expandVariables: true,
      cache: true,
    }),
    TypeOrmModule.forRoot(typeOrmConfig),
    AuthModule,
    EmployeeManagementModule,
    ProductionCenterModule,
    FarmModule,
    CommerceModule,
    ReceptionModule,
    MqttModule
  ],
})
export class AppModule { }
