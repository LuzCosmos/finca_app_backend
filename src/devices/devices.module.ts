import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';

@Module({
  imports: [
    HttpModule,
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService]
})
export class DevicesModule {} 