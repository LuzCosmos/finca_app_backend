import { Module } from '@nestjs/common';
import { MqttController } from './mqtt.controller';
import { MqttService } from './mqtt.service';
import { FarmModule } from '../farm/farm.module';
import { ConfigModule } from '@nestjs/config';
import { ProductionCenterModule } from '../production-center/production-center.module';

@Module({
  imports: [ConfigModule, FarmModule, ProductionCenterModule],
  controllers: [MqttController],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}