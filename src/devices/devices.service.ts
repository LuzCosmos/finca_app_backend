import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as Excel from 'xlsx';
import { Device, DeviceExcelRow, ChirpstackDevice } from './interfaces/device.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);
  private readonly chirpstackApiUrl: string;
  private readonly chirpstackApiToken: string;
  private readonly chirpstackTenantId: string;
  private readonly chirpstackApplicationId: string;
  private readonly defaultJoinEui: string;
  private readonly cattleProfileId: string;
  private readonly climateProfileId: string;
  private readonly nwkKey: string;
  private readonly appKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Obtener configuración de ChirpStack directamente de las variables de entorno
    const apiUrl = this.configService.get<string>('CHIRPSTACK_API_URL');
    const apiToken = this.configService.get<string>('CHIRPSTACK_API_TOKEN');
    const tenantId = this.configService.get<string>('CHIRPSTACK_TENANT_ID');
    const applicationId = this.configService.get<string>('CHIRPSTACK_APPLICATION_ID');
    const joinEui = this.configService.get<string>('CHIRPSTACK_CATTLE_JOIN_EUI');
    const profileId = this.configService.get<string>('CHIRPSTACK_CATTLE_PROFILE_ID');

    // Validar que todas las variables de entorno necesarias estén definidas
    if (!apiUrl) {
      throw new Error('CHIRPSTACK_API_URL no está definida en las variables de entorno');
    }
    if (!apiToken) {
      throw new Error('CHIRPSTACK_API_TOKEN no está definida en las variables de entorno');
    }
    if (!tenantId) {
      throw new Error('CHIRPSTACK_TENANT_ID no está definida en las variables de entorno');
    }
    if (!applicationId) {
      throw new Error('CHIRPSTACK_APPLICATION_ID no está definida en las variables de entorno');
    }
    if (!joinEui) {
      throw new Error('CHIRPSTACK_CATTLE_JOIN_EUI no está definida en las variables de entorno');
    }
    if (!profileId) {
      throw new Error('CHIRPSTACK_CATTLE_PROFILE_ID no está definida en las variables de entorno');
    }

    // Asignar valores validados
    this.chirpstackApiUrl = this.configService.get('CHIRPSTACK_API_URL')!;
    this.chirpstackApiToken = this.configService.get('CHIRPSTACK_API_TOKEN')!;
    this.chirpstackTenantId = this.configService.get('CHIRPSTACK_TENANT_ID')!;
    this.chirpstackApplicationId = this.configService.get('CHIRPSTACK_APPLICATION_ID')!;
    this.defaultJoinEui = this.configService.get('CHIRPSTACK_CATTLE_JOIN_EUI')!;
    this.cattleProfileId = this.configService.get('CHIRPSTACK_CATTLE_PROFILE_ID')!;

    this.logger.log('DevicesService inicializado con la configuración de ChirpStack');

    this.climateProfileId = this.configService.get('CHIRPSTACK_CLIMATE_PROFILE_ID')!;
    this.nwkKey = this.configService.get('CHIRPSTACK_NWK_KEY')!;
    this.appKey = this.configService.get('CHIRPSTACK_APP_KEY')!;

    // Agregar interceptor para ver los headers reales
    this.httpService.axiosRef.interceptors.request.use(request => {
      this.logger.debug('=== REQUEST INTERCEPTOR ===');
      this.logger.debug('URL:', request.url);
      this.logger.debug('Method:', request.method);
      this.logger.debug('Headers:', request.headers);
      this.logger.debug('Data:', JSON.stringify(request.data, null, 2));
      return request;
    });
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
    const chirpstackDevice: ChirpstackDevice = {
      applicationId: this.chirpstackApplicationId,
      devEui: device.devEui,
      name: device.deviceName,
      description: device.description || '',
      deviceProfileId: device.deviceProfileId || this.cattleProfileId,
      isDisabled: device.isDisabled || false,
      skipFcntCheck: false,
      tags: device.tags || {},
      variables: device.variables || {},
      joinEui: device.joinEui || this.defaultJoinEui,
    };

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