import { Injectable, ConflictException, BadRequestException, Logger, InternalServerErrorException } from '@nestjs/common';
import { DeviceRepository } from '../repositories/device.repository';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { Device } from '../entities/device.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { DeviceProfileRepository } from '../repositories/device-profile.repository';
import { ChirpstackDeviceInterface, ChirpstackDeviceKeysInterface } from '../interfaces/chirpstack-device.interface';
import * as ExcelJS from 'exceljs';
import { DeviceProfile } from '../entities/device-profile.entity';
import { promises as fs } from 'fs';

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
    const deviceChirpstack: ChirpstackDeviceInterface = {
      applicationId: deviceProfile.csApplicationId,
      description: createDeviceDto.description,
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
    return await this.createDevice(createDeviceDto, deviceProfile, deviceChirpstack, deviceKeys);
  }

  /**
   * Create a new device
   * @param createDeviceDto - The device to create
   * @param deviceProfile - The device profile
   * @param deviceChirpstack - The Chirpstack device
   * @param deviceKeys - The Chirpstack device keys
   * @returns The created device
   */
  async createDevice(createDeviceDto: CreateDeviceDto, deviceProfile: DeviceProfile, deviceChirpstack: ChirpstackDeviceInterface,deviceKeys: ChirpstackDeviceKeysInterface): Promise<Device> {
    const existingDevice = await this.deviceRepository.findByDevEuiAndTenantId(createDeviceDto.deveui, createDeviceDto.idTenant).catch(() => null);
    if (existingDevice) {
      throw new ConflictException(`Device with DevEUI ${createDeviceDto.deveui} already exists`);
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

  /**
   * Update a device
   * @param deveui - The device DevEUI
   * @param idTenant - The tenant ID
   * @param updateDeviceDto - The device to update
   * @returns The updated device
   */
  async update(deveui: string, idTenant: string, updateDeviceDto: UpdateDeviceDto): Promise<Device> {
    const existingDevice = await this.deviceRepository.findByDevEuiAndTenantId(deveui, idTenant).catch(() => null);
    if (!existingDevice) {
      throw new BadRequestException(`Device with DevEUI ${deveui} not found`);
    }
    return await this.deviceRepository.update(existingDevice.id, updateDeviceDto);
  }

  /**
   * Remove a device
   * @param id - The device ID
   */
  async remove(id: string): Promise<void> {
    await this.deviceRepository.remove(id);
  }

  /**
   * Check if a Chirpstack application exists
   * @param idApplication - The application ID
   * @returns True if the application exists, false otherwise
   */
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

  /**
   * Import devices from Excel file
   * @param file - The Excel file
   * @param idTenant - The tenant ID
   * @param deviceProfileId - The device profile ID
   * @returns The list of devices
   */
  async importDevicesFromExcel(file: Express.Multer.File, idTenant: string, deviceProfileId: string): Promise<any[]> {
    try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('The Excel sheet does not exist or is empty'); 
    }
    let deviceProfile: DeviceProfile | null = null;
    if (deviceProfileId) {
      deviceProfile = await this.deviceProfileRepository.findOne(deviceProfileId, idTenant);
      if (!deviceProfile) {
        throw new BadRequestException(`Device profile with ID ${deviceProfileId} not found`);
      }
    }
    const datos = await this.processSheet(worksheet, idTenant, deviceProfile);
    return datos;
    } catch (error) {
      throw new InternalServerErrorException('Error processing the Excel file');
    } finally {
      fs.unlink(file.path)
      .then(() =>
        this.logger.debug(`File ${file.originalname} deleted from ${file.path}`),
      )
      .catch(err =>
        this.logger.error(`Error deleting file ${file.path}: ${err.message}`),
      );
    }
  }

  /**
   * Process the Excel sheet
   * @param worksheet - The Excel sheet
   * @param idTenant - The tenant ID
   * @param deviceProfile - The device profile
   * @returns The list of devices
   */
  async processSheet(worksheet: ExcelJS.Worksheet, idTenant: string, deviceProfile: DeviceProfile | null): Promise<any> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<string>,
    };
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      try {
        const row = worksheet.getRow(rowNumber);
        const rowValues = Array.isArray(row.values)
          ? row.values.slice(1).map((v: any) =>
              typeof v === 'object' && v?.result !== undefined ? v.result : v,
            )
          : [];
        if (rowValues.length === 0) {
          results.errors.push(`Row ${rowNumber} is empty`);
          results.failed++;
          continue;
        }
        const deveui = rowValues[0];
        if (!deviceProfile && rowValues.length < 3) {
          results.errors.push(`Row ${rowNumber}, ${deveui}, has not the required columns: devEui, deviceName, deviceProfileId.`);
          results.failed++;
          continue;
        }
        if (rowValues.length < 2) {
          results.errors.push(`Row ${rowNumber}, ${deveui}, has not the required columns: devEui, deviceName.`);
          results.failed++;
          continue;
        }
        let currentDeviceProfile = deviceProfile;
        if (!currentDeviceProfile) {
          try {
            currentDeviceProfile = await this.deviceProfileRepository.findOne(rowValues[2], idTenant);
            if (!currentDeviceProfile) {
              throw new Error(`Device profile with ID ${rowValues[2]} not found`);
            }
          } catch (error) {
            results.errors.push(`Row ${rowNumber}, ${deveui}, ${error.message}`);
            results.failed++;
            continue;
          }
        }
        try {
          const device = await this.processExcelRow(rowValues, rowNumber, idTenant, currentDeviceProfile);
          results.success++;
        } catch (error) {
          results.errors.push(`Row ${rowNumber}, ${deveui}, ${error.message}`);
          results.failed++;
        }
      } catch (error) {
        results.errors.push(`Row ${rowNumber}, ${error.message}`);
        results.failed++;
      }
    }
    return results;
  }

  /**
   * Process the Excel row
   * @param rowValues - The row values
   * @param rowNumber - The row number
   * @param idTenant - The tenant ID
   * @param deviceProfile - The device profile
   * @returns The created device
   */
  async processExcelRow(rowValues: any[], rowNumber: number, idTenant: string, deviceProfile: DeviceProfile): Promise<Device> {
    const createDeviceDto: CreateDeviceDto = {
      deveui: rowValues[0],
      name: rowValues[1],
      description: "",
      idTenant: idTenant, 
      idDeviceProfile: deviceProfile.id,
      tags: {},
      variables: {},
    }
    const deviceChirpstack: ChirpstackDeviceInterface = {
      applicationId: deviceProfile.csApplicationId,
      description: createDeviceDto.description,
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
    if (rowValues.length >= 4) {
      createDeviceDto.description = rowValues[3];
      deviceChirpstack.description = rowValues[3];
    }
    if (rowValues.length >= 5) {
      deviceChirpstack.joinEui = rowValues[4];
    }
    if (rowValues.length >= 6) {
      deviceKeys.nwkKey = rowValues[5];
    }
    if (rowValues.length >= 7) {
      createDeviceDto.tags = rowValues[6];
      deviceChirpstack.tags = rowValues[6];
    }
    if (rowValues.length >= 8) {
      createDeviceDto.variables = rowValues[7];
      deviceChirpstack.variables = rowValues[7];
    }
    try {
      const device = await this.createDevice(createDeviceDto, deviceProfile, deviceChirpstack, deviceKeys);
      return device;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
  
} 