import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as Excel from 'xlsx';
import { Device, DeviceExcelRow, ChirpstackDevice } from './interfaces/device.interface';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);
  private readonly chirpstackApiUrl: string;
  private readonly chirpstackApiToken: string;
  private readonly applicationId: string;
  private readonly defaultJoinEui: string;
  private readonly cattleProfileId: string;
  private readonly climateProfileId: string;
  private readonly nwkKey: string;
  private readonly appKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.chirpstackApiUrl = this.configService.get('chirpstack.api_url');
    this.chirpstackApiToken = this.configService.get('chirpstack.api_token');
    this.applicationId = this.configService.get('chirpstack.application_id');
    this.defaultJoinEui = '0000000000000000';
    this.cattleProfileId = this.configService.get('chirpstack.device_profiles.cattle_profile_id');
    this.climateProfileId = this.configService.get('chirpstack.device_profiles.climate_profile_id');
    this.nwkKey = this.configService.get('chirpstack.device_profiles.nwk_key');
    this.appKey = this.configService.get('chirpstack.device_profiles.app_key');

    // Agregar interceptor para ver los headers reales
    this.httpService.axiosRef.interceptors.request.use(request => {
      this.logger.debug('=== REQUEST INTERCEPTOR ===');
      this.logger.debug('URL:', request.url);
      this.logger.debug('Method:', request.method);
      this.logger.debug('Headers:', request.headers);
      this.logger.debug('Data:', JSON.stringify(request.data, null, 2));
      return request;
    });

    // Debug logs
    this.logger.debug('Configuration loaded:');
    this.logger.debug(`API URL: ${this.chirpstackApiUrl}`);
    this.logger.debug(`API Token: ${this.chirpstackApiToken}`);
    this.logger.debug(`Application ID: ${this.applicationId}`);
    this.logger.debug(`Cattle Profile ID: ${this.cattleProfileId}`);
    this.logger.debug(`Climate Profile ID: ${this.climateProfileId}`);
    this.logger.debug(`NWK Key: ${this.nwkKey}`);
    this.logger.debug(`APP Key: ${this.appKey}`);

    if (!this.applicationId) {
      this.logger.error('Application ID is not configured in .conf file');
      throw new Error('Application ID is required');
    }
  }

  async createSingleDevice(device: Device): Promise<any> {
    try {
      const chirpstackDevice = this.mapToChirpstackDevice(device);
      
      this.logger.debug('Creating device with data:');
      this.logger.debug(JSON.stringify({ device: chirpstackDevice }, null, 2));
      
      const response = await this.httpService.axiosRef.post(
        `${this.chirpstackApiUrl}/api/devices`,
        { device: chirpstackDevice },
        {
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Grpc-Metadata-Authorization': `Bearer ${this.chirpstackApiToken}`
          }
        }
      );

      this.logger.debug('Device created successfully');
      await this.createDeviceKeys(device.devEui);
      
      return response.data;
    } catch (error) {
      this.logger.error(`Error creating device in ChirpStack: ${error.message}`);
      this.logger.error('Full error:', error);
      throw error;
    }
  }

  async importFromExcel(file: Express.Multer.File): Promise<{
    success: number;
    failed: number;
    errors: Array<{ devEui: string; error: string }>;
  }> {
    const workbook = Excel.read(file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: DeviceExcelRow[] = Excel.utils.sheet_to_json(worksheet);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ devEui: string; error: string }>,
    };

    for (const row of rows) {
      try {
        const device = this.mapExcelRowToDevice(row);
        await this.createSingleDevice(device);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          devEui: row.devEui,
          error: error.message,
        });
      }
    }

    return results;
  }

  private mapExcelRowToDevice(row: DeviceExcelRow): Device {
    this.logger.debug('Mapping Excel row:', row);
    
    const device: Device = {
      devEui: row.devEui,
      deviceName: row.deviceName,
      deviceType: row.deviceType as 'CATTLE' | 'CLIMATE',
      deviceProfileId: row.deviceProfileId || (row.deviceType === 'CATTLE' ? this.cattleProfileId : this.climateProfileId) || '',
      joinEui: row.joinEui || this.defaultJoinEui,
      isDisabled: false
    };

    if (row.description) {
      device.description = row.description;
    }

    if (row.tags) {
      device.tags = row.tags.split(',').reduce((acc, tag) => {
        const [key, value] = tag.split(':');
        acc[key.trim()] = value.trim();
        return acc;
      }, {} as Record<string, string>);
    }

    if (row.variables) {
      device.variables = row.variables.split(',').reduce((acc, variable) => {
        const [key, value] = variable.split(':');
        acc[key.trim()] = value.trim();
        return acc;
      }, {} as Record<string, string>);
    }

    this.logger.debug('Mapped to device:', device);
    return device;
  }

  private mapToChirpstackDevice(device: Device): ChirpstackDevice {
    this.logger.debug('Mapping device:', device);
    
    const chirpstackDevice: ChirpstackDevice = {
      applicationId: this.applicationId || '',
      devEui: device.devEui,
      name: device.deviceName,
      description: device.description,
      deviceProfileId: device.deviceProfileId,
      isDisabled: device.isDisabled || false,
      joinEui: device.joinEui || this.defaultJoinEui,
      skipFcntCheck: true,
      tags: {
        ...device.tags,
        deviceType: device.deviceType
      },
      variables: device.variables || {}
    };

    this.logger.debug('Mapped to Chirpstack device:', chirpstackDevice);
    return chirpstackDevice;
  }

  private async createDeviceKeys(devEui: string): Promise<void> {
    try {
      const response = await this.httpService.axiosRef.post(
        `${this.chirpstackApiUrl}/api/devices/${devEui}/keys`,
        {
          deviceKeys: {
            appKey: this.appKey,
            nwkKey: this.nwkKey
          },
        },
        {
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Grpc-Metadata-Authorization': `Bearer ${this.chirpstackApiToken}`
          }
        }
      );
      this.logger.debug('Device keys created:', response.data);
      return response.data;
    } catch (error) {
      this.logger.error(`Error creating device keys: ${error.message}`);
      throw error;
    }
  }

  async updateDevice(devEui: string, device: Device): Promise<any> {
    try {
      const chirpstackDevice = this.mapToChirpstackDevice({
        ...device,
        devEui
      });
      
      const response = await this.httpService.axiosRef.put(
        `${this.chirpstackApiUrl}/api/devices/${devEui}`,
        { device: chirpstackDevice },
        {
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Grpc-Metadata-Authorization': `Bearer ${this.chirpstackApiToken}`
          }
        }
      );
      
      return response.data;
    } catch (error) {
      this.logger.error(`Error updating device in ChirpStack: ${error.message}`);
      throw error;
    }
  }
} 