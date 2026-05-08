import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './entities/device.entity';
import { DeviceProfile } from './entities/device-profile.entity';
import { DeviceConfigurationProfile } from './entities/device-configuration-profile.entity';
import { DeviceRemoteConfiguration } from './entities/device-remote-configuration.entity';
import { DeviceDownlinkCommand } from './entities/device-downlink-command.entity';

import { DevicesController } from './controllers/devices.controller';
import { DeviceProfilesController } from './controllers/device-profiles.controller';
import { DeviceRemoteConfigController } from './controllers/device-remote-config.controller';
import { DeviceConfigurationProfileController } from './controllers/device-configuration-profile.controller';

import { DevicesService } from './services/devices.service';
import { DeviceProfilesService } from './services/device-profiles.service';
import { ChirpStackDownlinkService } from './services/chirpstack-downlink.service';
import { DeviceRemoteConfigurationService } from './services/device-remote-configuration.service';

import { DeviceRepository } from './repositories/device.repository';
import { DeviceProfileRepository } from './repositories/device-profile.repository';
import { DeviceConfigurationProfileRepository } from './repositories/device-configuration-profile.repository';
import { DeviceRemoteConfigurationRepository } from './repositories/device-remote-configuration.repository';
import { DeviceDownlinkCommandRepository } from './repositories/device-downlink-command.repository';

import { Lw001BgProDownlinkCodecService } from './lw001-bg-pro/lw001-bg-pro-downlink-codec.service';
import { Lw001BgProUplinkParserService } from './lw001-bg-pro/lw001-bg-pro-uplink-parser.service';

import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ApplicationPermissionsModule } from '../../common/application-permissions/application-permissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Device,
      DeviceProfile,
      DeviceConfigurationProfile,
      DeviceRemoteConfiguration,
      DeviceDownlinkCommand,
    ]),
    HttpModule,
    ConfigModule,
    ApplicationPermissionsModule,
  ],
  controllers: [
    DeviceProfilesController,
    DevicesController,
    DeviceRemoteConfigController,
    DeviceConfigurationProfileController,
  ],
  providers: [
    DevicesService,
    DeviceProfilesService,
    DeviceRepository,
    DeviceProfileRepository,
    DeviceConfigurationProfileRepository,
    DeviceRemoteConfigurationRepository,
    DeviceDownlinkCommandRepository,
    ChirpStackDownlinkService,
    Lw001BgProDownlinkCodecService,
    Lw001BgProUplinkParserService,
    DeviceRemoteConfigurationService,
  ],
  exports: [
    DevicesService,
    DeviceProfilesService,
    DeviceRemoteConfigurationService,
    Lw001BgProUplinkParserService,
    Lw001BgProDownlinkCodecService,
    ChirpStackDownlinkService,
    DeviceRepository,
  ],
})
export class ProductionCenterModule {}
