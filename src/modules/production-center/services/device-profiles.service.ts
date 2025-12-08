import { Injectable, ConflictException, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { DeviceProfileRepository } from '../repositories/device-profile.repository';
import { CreateDeviceProfileDto } from '../dto/create-device-profile.dto';
import { UpdateDeviceProfileDto } from '../dto/update-device-profile.dto';
import { DeviceProfile } from '../entities/device-profile.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { DevicesService } from './devices.service';

@Injectable()
export class DeviceProfilesService {
  private readonly chirpstackUrl: string;
  private readonly chirpstackToken: string;
  private readonly logger = new Logger(DeviceProfilesService.name);

  constructor(
    private readonly deviceProfileRepository: DeviceProfileRepository,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly devicesService: DevicesService,
  ) {
    const chirpstackUrl = this.configService.get<string>('CHIRPSTACK_API_URL');
    const chirpstackToken = this.configService.get<string>('CHIRPSTACK_API_KEY');
    if (!chirpstackUrl || !chirpstackToken) {
      throw new Error('CHIRPSTACK_API_URL and CHIRPSTACK_API_KEY must be defined in environment variables');
    }
    this.chirpstackUrl = chirpstackUrl;
    this.chirpstackToken = chirpstackToken;
  }

  /**
   * Create a new device profile
   * @param createDeviceProfileDto - The DTO with the data of the device profile to create
   * @returns The created device profile
   * @throws ConflictException if a device profile with the same name already exists
   * @throws BadRequestException if the device profile does not exist in Chirpstack or does not have permissions, or if application does not exist in Chirpstack
   */
  async create(createDeviceProfileDto: CreateDeviceProfileDto): Promise<DeviceProfile> {
    const existingProfile = await this.deviceProfileRepository.findByNameAndTenantId(createDeviceProfileDto.name, createDeviceProfileDto.idTenant).catch(() => null);
    if (existingProfile) {
      throw new ConflictException(`Device profile with name ${createDeviceProfileDto.name} already exists`);
    }
    await this.validateChirpstackDeviceProfile(createDeviceProfileDto.idChipstack);
    await this.devicesService.existChirpstackApplicationId(createDeviceProfileDto.csApplicationId);
    const devProfile = await this.deviceProfileRepository.create(createDeviceProfileDto); 
    this.logger.debug(`Device profile ${devProfile.name} created successfully`);
    this.logger.debug(devProfile);
    return devProfile;
  }

  /**
   * Validate if the device profile exists in Chirpstack
   * @param idChipstack - The ID of the device profile to validate
   * @returns The device profile
   * @throws BadRequestException if the device profile does not exist in Chirpstack
   */
  private async validateChirpstackDeviceProfile(idChipstack: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.chirpstackUrl}/api/device-profiles/${idChipstack}`, {
          headers: {
            'accept': 'application/json',
            'Grpc-Metadata-Authorization': `Bearer ${this.chirpstackToken}`,
          },
        }),
      );
      if (!response.data) {
        throw new BadRequestException(`Device profile with ID ${idChipstack} not found in Chirpstack`);
      }
      return response.data;
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 404) {
        throw new BadRequestException(`Device profile with ID ${idChipstack} not found in Chirpstack`);
      }
      this.logger.error(error.message);
      throw new BadRequestException('Error validating device profile with Chirpstack');
    }
  }

  /**
   * Find all device profiles by tenant ID
   * @param idTenant - The ID of the tenant
   * @returns The list of device profiles
   */
  async findAll(idTenant: string): Promise<DeviceProfile[]> {
    return await this.deviceProfileRepository.findAll(idTenant);
  }

  /**
   * Find a device profile by ID and tenant ID
   * @param id - The ID of the device profile
   * @param idTenant - The ID of the tenant
   * @returns The device profile
   */
  async findOne(id: string, idTenant: string): Promise<DeviceProfile> {
    return await this.deviceProfileRepository.findOne(id, idTenant);
  }

  /**
   * Update a device profile
   * @param id - The ID of the device profile
   * @param idTenant - The ID of the tenant
   * @param updateDeviceProfileDto - The DTO with the data of the device profile to update
   * @returns The updated device profile
   */
  async update(id: string, idTenant: string, updateDeviceProfileDto: UpdateDeviceProfileDto): Promise<DeviceProfile> {
    try {
      await this.deviceProfileRepository.findOne(id, idTenant);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new ForbiddenException(`You don't have permission to update this device profile`);
      }
      throw error;
    }

    if (updateDeviceProfileDto.name) {
      const existingProfile = await this.deviceProfileRepository.findByNameAndTenantId(updateDeviceProfileDto.name, idTenant).catch(() => null);
      if (existingProfile && existingProfile.id !== id) {
        throw new ConflictException(`Device profile with name ${updateDeviceProfileDto.name} already exists`);
      }
    }
    if (updateDeviceProfileDto.idChipstack) {
      await this.validateChirpstackDeviceProfile(updateDeviceProfileDto.idChipstack);
    }
    return await this.deviceProfileRepository.update(id, updateDeviceProfileDto);
  }

  /**
   * Remove a device profile
   * @param id - The ID of the device profile
   * @param idTenant - The ID of the tenant
   */
  async remove(id: string, idTenant: string): Promise<void> {
    try {
      await this.deviceProfileRepository.findOne(id, idTenant);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new ForbiddenException(`You don't have permission to delete this device profile`);
      }
      throw error;
    }
    await this.deviceProfileRepository.remove(id);
  }
} 