import { Injectable, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { DeviceRepository } from '../repositories/device.repository';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { Device } from '../entities/device.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { DeviceProfileRepository } from '../repositories/device-profile.repository';
import { ChirpstackDeviceInterface, ChirpstackDeviceKeysInterface } from '../interfaces/chirpstack-device.interface';

@Injectable()
export class DevicesService {

  private readonly chirpstackUrl: string;
  private readonly chirpstackToken: string;
  private readonly logger: Logger = new Logger(DevicesService.name);

  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly deviceProfileRepository: DeviceProfileRepository,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const chirpstackUrl = this.configService.get<string>('CHIRPSTACK_API_URL');
    const chirpstackToken = this.configService.get<string>('CHIRPSTACK_API_TOKEN');
    if (!chirpstackUrl || !chirpstackToken) {
      throw new Error('CHIRPSTACK_API_URL and CHIRPSTACK_API_TOKEN must be defined in environment variables');
    }
    this.chirpstackUrl = chirpstackUrl;
    this.chirpstackToken = chirpstackToken;
  }

  /**
   * Create a new device
   * @param createDeviceDto - The device to create
   * @returns The created device
   */
  async create(createDeviceDto: CreateDeviceDto): Promise<Device> {
    const deviceProfile = await this.deviceProfileRepository.findOne(createDeviceDto.idDeviceProfile, createDeviceDto.idTenant);
    if (!deviceProfile) {
      throw new BadRequestException(`Device profile with ID ${createDeviceDto.idDeviceProfile} not found`);
    }
    const existingDevice = await this.deviceRepository.findByDevEuiAndTenantId(createDeviceDto.deveui, createDeviceDto.idTenant).catch(() => null);
    if (existingDevice) {
      throw new ConflictException(`Device with DevEUI ${createDeviceDto.deveui} already exists`);
    }
    const deviceChirpstack: ChirpstackDeviceInterface = {
      applicationId: deviceProfile.csApplicationId,
      description: deviceProfile.description,
      devEui: createDeviceDto.deveui,
      deviceProfileId: deviceProfile.idChipstack,
      isDisabled: false,
      joinEui: deviceProfile.csJoineui,
      name: createDeviceDto.name,
      skipFcntCheck: false,
      tags: {},
      variables: {},
    }
    const deviceKeys: ChirpstackDeviceKeysInterface = {
      appKey: deviceProfile.csAppKey,
      nwkKey: deviceProfile.csNwkKey
    }
    const data = await this.createDeviceInChirpstack(deviceChirpstack, deviceKeys);
    if (!data) {
      throw new BadRequestException(`Error creating device in Chirpstack`);
    }
    return await this.deviceRepository.create(createDeviceDto);
  }

  /**
   * Get a device from Chirpstack
   * @param deveui - The device DevEUI
   * @returns True if the device exists, false otherwise
   */
  async getDeviceFromChirpstack(deveui: string): Promise<boolean> {
    try {
      const response = await this.httpService.axiosRef.get(`${this.chirpstackUrl}/api/devices/${deveui}`, 
        {
        headers: {
          'accept': 'application/json',
          'Grpc-Metadata-Authorization': `Bearer ${this.chirpstackToken}`,
        },
      });
      if (response.status === 200) {
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(error);
      if (error.response?.status === 401) {
        return false;
      }
      throw new BadRequestException(`Error validating device ${deveui} with Chirpstack`);
    }
  }

  /**
   * Create a new device in Chirpstack
   * @param chirpstackDevice - The device to create
   * @returns The created device
   */
  async createDeviceInChirpstack(chirpstackDevice: ChirpstackDeviceInterface, deviceKeys: ChirpstackDeviceKeysInterface): Promise<boolean> {
    try {
      const deviceExists = await this.getDeviceFromChirpstack(chirpstackDevice.devEui);
      if (!deviceExists) {
        const response = await this.httpService.axiosRef.post(
          `${this.chirpstackUrl}/api/devices`, 
          { device: chirpstackDevice}, 
          {
            headers: {
              'accept': 'application/json',
              'Content-Type': 'application/json',
              'Grpc-Metadata-Authorization':  `Bearer ${this.chirpstackToken}`,
            },
          }
        );
        if (response.status === 200) {
          const response = await this.httpService.axiosRef.post(
            `${this.chirpstackUrl}/api/devices/${chirpstackDevice.devEui}/keys`, 
            {
              deviceKeys: deviceKeys
            },
            {
              headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'Grpc-Metadata-Authorization':  `Bearer ${this.chirpstackToken}`
              },
            }
          );
        }
        return true;
      } else {
        return true;
      }
    } catch (error) {
      this.logger.error(error);
      throw new BadRequestException(`Error validating device ${chirpstackDevice.devEui} with Chirpstack`);
    }
  } 

  async findOne(deveui: string, idTenant: string): Promise<Device> {
    return await this.deviceRepository.findByDevEuiAndTenantId(deveui, idTenant);
  }

  async update(deveui: string, idTenant: string, updateDeviceDto: UpdateDeviceDto): Promise<Device> {
    const existingDevice = await this.deviceRepository.findByDevEuiAndTenantId(deveui, idTenant).catch(() => null);
    if (!existingDevice) {
      throw new BadRequestException(`Device with DevEUI ${deveui} not found`);
    }
    return await this.deviceRepository.update(existingDevice.id, updateDeviceDto);
  }

  async remove(id: string): Promise<void> {
    await this.deviceRepository.remove(id);
  }

  async existChirpstackApplicationId(idApplication: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.chirpstackUrl}/api/applications/${idApplication}`, {
          headers: {
          'accept': 'application/json',
          'Grpc-Metadata-Authorization': `Bearer ${this.chirpstackToken}`,
        },
      }),
    );
    return response.data;
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 404) {
        throw new BadRequestException(`Application with ID ${idApplication} not found in Chirpstack`);
      }
      throw new BadRequestException('Error validating application with Chirpstack');
    }
  }

  /**
   * Find all devices by tenant ID
   * @param idTenant - The tenant ID
   * @returns The list of devices
   */
  async findAll(idTenant: string): Promise<Device[]> {
    return await this.deviceRepository.findAll(idTenant);
  }
} 