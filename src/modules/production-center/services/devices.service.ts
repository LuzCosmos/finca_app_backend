import { Injectable, ConflictException, BadRequestException, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DeviceRepository } from '../repositories/device.repository';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { Device } from '../entities/device.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { DeviceProfileRepository } from '../repositories/device-profile.repository';
import { ChirpstackDeviceInterface, ChirpstackDeviceKeysInterface, ChirpstackDeviceKeysUpdateInterface, ChirpstackDeviceUpdateInterface } from '../interfaces/chirpstack-device.interface';
import { DeviceProfile } from '../entities/device-profile.entity';
import { promises as fs } from 'fs';
import { EntityManager } from 'typeorm';
import { DeviceListItemResponseDto } from '../dto/device-list-item-response.dto';
import { mapDeviceToListItem } from '../mappers/device-list.mapper';
import {
  ImportDeviceRowIssueDto,
  ImportDevicesResultDto,
} from '../dto/import-devices-result.dto';
import {
  allRowsHaveValidProfileId,
  resolveLw001AppKeyValue,
  resolveLw001JoinEuiValue,
  buildLw001DeviceName,
  isValidUuid,
  loadLw001ImportLayout,
  Lw001ParsedRow,
  normalizeLw001Deveui,
  normalizeOptionalHex16,
  normalizeOptionalHex32,
} from '../import-lw001/devices-import-lw001.helper';
import { ImportLw001Reason } from '../import-lw001/import-lw001.constants';

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
    const chirpstackToken = this.configService.get<string>('CHIRPSTACK_API_KEY');
    if (!chirpstackUrl || !chirpstackToken) {
      throw new Error('CHIRPSTACK_API_URL and CHIRPSTACK_API_KEY must be defined in environment variables');
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
    if (createDeviceDto.csJoineui) {
      deviceChirpstack.joinEui = createDeviceDto.csJoineui;
    } else {
      createDeviceDto.csJoineui = deviceProfile.csJoineui
    }
    if (createDeviceDto.csApplicationId) {
      deviceChirpstack.applicationId = createDeviceDto.csApplicationId;
    } else {
      createDeviceDto.csApplicationId = deviceProfile.csApplicationId;
    }
    if (createDeviceDto.csAppKey) {
      deviceKeys.appKey = createDeviceDto.csAppKey;
    } else {
      createDeviceDto.csAppKey = deviceProfile.csAppKey;
    }
    if (createDeviceDto.csNwkKey) {
      deviceKeys.nwkKey = createDeviceDto.csNwkKey;
    } else {
      createDeviceDto.csNwkKey = deviceProfile.csNwkKey;
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
  async createDevice(createDeviceDto: CreateDeviceDto, deviceProfile: DeviceProfile, deviceChirpstack: ChirpstackDeviceInterface, deviceKeys: ChirpstackDeviceKeysInterface): Promise<Device> {
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
      this.logger.debug(response.data);
      if (response.status === 200) {
        return true;
      }
      return false;
    } catch (error) {
      const axiosError = error as { response?: { status?: number; data?: { code?: number } } };
      const status = axiosError.response?.status;
      const grpcCode = axiosError.response?.data?.code;
      if (status === 401) {
        return false;
      }
      // Dispositivo inexistente en ChirpStack (HTTP 404 o gRPC NOT_FOUND = 5).
      if (status === 404 || grpcCode === 5) {
        return false;
      }
      this.logger.error(axiosError.response?.data);
      const errorMsg = axiosError.response?.data
        ? JSON.stringify(axiosError.response.data)
        : (error instanceof Error ? error.message : 'Unknown error');
      throw new BadRequestException(`Error validating device ${deveui} with Chirpstack, error: ${errorMsg}`);
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
          { device: chirpstackDevice },
          {
            headers: {
              'accept': 'application/json',
              'Content-Type': 'application/json',
              'Grpc-Metadata-Authorization': `Bearer ${this.chirpstackToken}`,
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
                'Grpc-Metadata-Authorization': `Bearer ${this.chirpstackToken}`
              },
            }
          );
        }
        return true;
      } else {
        const response = await this.callUpdateDeviceInChirpstack(chirpstackDevice.devEui, chirpstackDevice, deviceKeys);
        return response;
      }

    } catch (error) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : (error.message || 'Unknown error');
      this.logger.error(`Error creating device ${chirpstackDevice.devEui} in Chirpstack: ${errorMsg}`, error.stack);
      throw new BadRequestException(`Error creating device ${chirpstackDevice.devEui} with Chirpstack, error: ${errorMsg}`);
    }
  }

  /**
   * Find a device by DevEUI and tenant ID
   * @param deveui - The device DevEUI
   * @param idTenant - The tenant ID
   * @returns The device
   */
  async findOne(deveui: string, idTenant: string, manager?: EntityManager): Promise<Device> {
    return await this.deviceRepository.findByDevEuiAndTenantId(deveui, idTenant, manager);
  }

  async findById(id: string, idTenant: string, manager?: EntityManager): Promise<Device> {
    return await this.deviceRepository.findByIdAndTenantId(id, idTenant, manager);
  }

  /**
   * Update a device
   * @param deveui - The device DevEUI
   * @param idTenant - The tenant ID
   * @param updateDeviceDto - The device to update
   * @returns The updated device
   */
  async update(deveui: string, idTenant: string, updateDeviceDto: UpdateDeviceDto, manager?: EntityManager): Promise<Device> {
    const existingDevice = await this.deviceRepository.findByDevEuiAndTenantId(deveui, idTenant, manager).catch(() => null);
    if (!existingDevice) {
      throw new BadRequestException(`Device with DevEUI ${deveui} not found`);
    }
    return await this.updateWithDevice(existingDevice, updateDeviceDto, manager)
  }

  /**
   * Update a device
   * @param device - The device
   * @param updateDeviceDto - The device to update
   * @param manager - The manager of the transaction (optional)
   * @returns The updated device
   */
  async updateWithDevice(device: Device, updateDeviceDto: UpdateDeviceDto, manager?: EntityManager): Promise<Device> {
    this.logger.debug(`log_device 1: Updating device ${device.deveui} with device tags: ${JSON.stringify(updateDeviceDto)}`);
    try {

      const deviceChirpstack = await this.updateDeviceInChirpstack(device.deveui, updateDeviceDto, device);
      if (!deviceChirpstack) {
        this.logger.debug(`log_device 2: Error updating device in Chirpstack`);
        throw new BadRequestException(`Error updating device in Chirpstack`);
      }
      this.logger.debug(`log_device 3: Device updated in Chirpstack: ${deviceChirpstack}`);
      const deviceUpdated = await this.deviceRepository.update(device.id, updateDeviceDto, manager);
      if (!deviceUpdated) {
        this.logger.debug(`log_device 4: Error updating device ${device.deveui}`);
        throw new BadRequestException(`Error updating device ${device.deveui}`);
      }
      this.logger.debug(`log_device 5: Device updated: ${deviceUpdated.id}`);
      return deviceUpdated;

    } catch (error) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : (error.message || 'Unknown error');
      this.logger.error(`log_device 6: Error updating device ${device.deveui} with Chirpstack, message: ${error.message}, error: ${errorMsg}`);
      this.logger.debug(`log_device 7: ------------------------------------------------------------`);
      this.logger.debug(`log_device 7:${JSON.stringify(error)}`);
      this.logger.debug(`log_device 7: +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++`);
      throw new BadRequestException(`Error updating device ${device.deveui} with Chirpstack, message: ${error.message}, error: ${errorMsg}`);
    }
  }

  /**
   * Update a device in Chirpstack
   * @param deveui - The device DevEUI
   * @param updateDeviceDto - The device to update
   * @returns True if the device was updated, false otherwise
   */
  async updateDeviceInChirpstack(deveui: string, updateDeviceDto: UpdateDeviceDto, device: Device): Promise<boolean> {
    const deviceChirpstack: ChirpstackDeviceUpdateInterface = {}
    if (updateDeviceDto.csApplicationId) {
      deviceChirpstack.applicationId = updateDeviceDto.csApplicationId;
    } else {
      deviceChirpstack.applicationId = device.csApplicationId;
    }
    if (updateDeviceDto.description) {
      deviceChirpstack.description = updateDeviceDto.description;
    }
    if (updateDeviceDto.deveui) {
      deviceChirpstack.devEui = updateDeviceDto.deveui;
    }
    if (updateDeviceDto.idDeviceProfile) {
      deviceChirpstack.deviceProfileId = updateDeviceDto.idDeviceProfile;
    } else {
      deviceChirpstack.deviceProfileId = device.idChirpstackProfile;
    }
    /*if (updateDeviceDto.isDisabled) {
      deviceChirpstack.isDisabled = updateDeviceDto.isDisabled;
    }*/
    if (updateDeviceDto.csJoineui) {
      deviceChirpstack.joinEui = updateDeviceDto.csJoineui;
    }
    if (updateDeviceDto.name) {
      deviceChirpstack.name = updateDeviceDto.name;
    } else {
      deviceChirpstack.name = device.name;
    }
    /*if (updateDeviceDto.skipFcntCheck) {
      deviceChirpstack.skipFcntCheck = updateDeviceDto.skipFcntCheck;
    } */
    if (updateDeviceDto.tags) {
      deviceChirpstack.tags = updateDeviceDto.tags;
    }
    if (updateDeviceDto.variables) {
      deviceChirpstack.variables = updateDeviceDto.variables;
    }
    const deviceKeys: ChirpstackDeviceKeysUpdateInterface = {}
    if (updateDeviceDto.csAppKey) {
      deviceKeys.appKey = updateDeviceDto.csAppKey;
    }
    if (updateDeviceDto.csNwkKey) {
      deviceKeys.nwkKey = updateDeviceDto.csNwkKey;
    }
    const response = await this.callUpdateDeviceInChirpstack(deveui, deviceChirpstack, deviceKeys);
    return response;
  }

  /**
   * Call the update device in Chirpstack
   * @param deveui - The device DevEUI
   * @param deviceChirpstack - The device to update
   * @param deviceKeys - The device keys
   * @returns True if the device was updated, false otherwise
   */
  async callUpdateDeviceInChirpstack(deveui: string, deviceChirpstack: ChirpstackDeviceUpdateInterface, deviceKeys: ChirpstackDeviceKeysUpdateInterface): Promise<boolean> {
    try {
      this.logger.debug(`log_device 8: ${JSON.stringify(deviceChirpstack)}`);
      this.logger.debug(`log_device 8: fin ------------------------------------------------------------`);
      const response = await this.httpService.axiosRef.put(
        `${this.chirpstackUrl}/api/devices/${deveui}`,
        { device: deviceChirpstack },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Grpc-Metadata-Authorization': `Bearer ${this.chirpstackToken}`
          },
        }
      );
      if (response.status === 200) {
        this.logger.debug(`log_device 9: OK ------------------------------------------------------------`);
        if (deviceKeys.appKey || deviceKeys.nwkKey) {
          try {
            const response = await this.httpService.axiosRef.post(
              `${this.chirpstackUrl}/api/devices/${deveui}/keys`,
              { deviceKeys: deviceKeys },
              {
                headers: {
                  'accept': 'application/json',
                  'Content-Type': 'application/json',
                  'Grpc-Metadata-Authorization': `Bearer ${this.chirpstackToken}`
                },
              }
            );
          } catch (error) {
            this.logger.error('Response Chirpstack data:', error.response?.data);
            const response = await this.httpService.axiosRef.put(
              `${this.chirpstackUrl}/api/devices/${deveui}/keys`,
              {
                deviceKeys: deviceKeys
              },
              {
                headers: {
                  'accept': 'application/json',
                  'Content-Type': 'application/json',
                  'Grpc-Metadata-Authorization': `Bearer ${this.chirpstackToken}`
                },
              }
            );
          }
          if (response.status === 200) {
            return true;
          } else {
            return false;
          }
        }
        return true;
      }
      return false;
    } catch (error) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : (error.message || 'Unknown error');
      throw new BadRequestException(`Error updating device ${deveui} with Chirpstack, message: ${error.message}, error: ${errorMsg}`);
    }
  }

  /**
   * Remove a device
   * @param id - Local device UUID (`devices.id`)
   * @param idTenant - Tenant ID for scoping
   */
  async remove(id: string, idTenant: string): Promise<void> {
    const device = await this.deviceRepository.findByIdAndTenantId(id, idTenant);
    if (device == null) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }
    try {
      const response = await this.httpService.axiosRef.delete(
        `${this.chirpstackUrl}/api/devices/${device.deveui}`,
        {
          headers: {
            'accept': 'application/json',
            'Grpc-Metadata-Authorization': `Bearer ${this.chirpstackToken}`,
          },
        },
      );
      if (response.status !== 200) {
        throw new BadRequestException(
          `Error removing device ${device.deveui} from Chirpstack: unexpected status ${response.status}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMsg = error.response?.data
        ? JSON.stringify(error.response.data)
        : (error.message || 'Unknown error');
      const status = error.response?.status;
      throw new BadRequestException(
        `Error removing device ${device.deveui} from Chirpstack (HTTP ${status ?? 'n/a'}): ${errorMsg}`,
      );
    }
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
        throw new BadRequestException(`Application with ID ${idApplication} not found in Chirpstack, message: ${error.message}, error: ${error.response?.data}`);
      }
      throw new BadRequestException(`Error validating application with Chirpstack, message: ${error.message}, error: ${error.response?.data}`);
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

  /** Solo id, deveui, name — para sincronización offline en móvil (sin claves). */
  async findAllCatalog(
    idTenant: string,
  ): Promise<{ id: string; deveui: string; name: string }[]> {
    const rows = await this.deviceRepository.findAll(idTenant);
    return rows.map((d) => ({
      id: d.id,
      deveui: d.deveui,
      name: d.name,
    }));
  }

  async findAllListSummary(idTenant: string): Promise<DeviceListItemResponseDto[]> {
    const rows = await this.deviceRepository.findAllForList(idTenant);
    return rows.map(mapDeviceToListItem);
  }

  /**
   * Import devices from LW001-BG PRO template (.xlsx, .xls, .csv).
   */
  async importDevicesFromExcel(
    file: Express.Multer.File,
    idTenant: string,
    deviceProfileId?: string,
  ): Promise<ImportDevicesResultDto> {
    try {
      const buffer = await fs.readFile(file.path);
      const layout = loadLw001ImportLayout(buffer, file.originalname);
      const multipartProfileId = deviceProfileId?.trim() ?? '';

      const profileValid = (id: string) => isValidUuid(id);
      const allRowsHaveProfileB = allRowsHaveValidProfileId(
        layout.dataRows,
        profileValid,
      );

      if (!allRowsHaveProfileB && !multipartProfileId) {
        throw new BadRequestException(ImportLw001Reason.DEVICE_PROFILE_ID_REQUIRED);
      }

      let defaultProfile: DeviceProfile | null = null;
      if (multipartProfileId) {
        defaultProfile = await this.deviceProfileRepository.findOptionalByIdAndTenant(
          multipartProfileId,
          idTenant,
        );
        if (!defaultProfile) {
          throw new BadRequestException(ImportLw001Reason.DEVICE_PROFILE_ID_INVALID);
        }
      }

      const result: ImportDevicesResultDto = {
        totalRows: layout.dataRows.length,
        created: 0,
        updated: 0,
        duplicateDeveuisInFile: [],
        warnings: [],
        errors: [],
      };

      const deveuiOccurrences = new Map<string, number>();
      for (const row of layout.dataRows) {
        const normalized = normalizeLw001Deveui(row.devEui);
        if (!normalized) {
          continue;
        }
        deveuiOccurrences.set(normalized, (deveuiOccurrences.get(normalized) ?? 0) + 1);
      }
      result.duplicateDeveuisInFile = [...deveuiOccurrences.entries()]
        .filter(([, count]) => count > 1)
        .map(([deveui]) => deveui);

      const seenDeveuisInFile = new Set<string>();

      for (const row of layout.dataRows) {
        await this.processLw001ImportRow(
          row,
          idTenant,
          defaultProfile,
          seenDeveuisInFile,
          result,
        );
      }

      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `LW001 import failed: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Error processing the import file');
    } finally {
      fs.unlink(file.path)
        .then(() =>
          this.logger.debug(`File ${file.originalname} deleted from ${file.path}`),
        )
        .catch((err) =>
          this.logger.error(`Error deleting file ${file.path}: ${err.message}`),
        );
    }
  }

  private async processLw001ImportRow(
    row: Lw001ParsedRow,
    idTenant: string,
    defaultProfile: DeviceProfile | null,
    seenDeveuisInFile: Set<string>,
    result: ImportDevicesResultDto,
  ): Promise<void> {
    const normalizedDeveui = normalizeLw001Deveui(row.devEui);
    if (!normalizedDeveui) {
      result.errors.push(
        this.buildImportIssueForLw001Row(ImportLw001Reason.DEVEUI_INVALID_LENGTH, row),
      );
      return;
    }

    const profile = await this.resolveLw001ProfileForRow(
      row,
      idTenant,
      defaultProfile,
      result,
    );
    if (!profile) {
      return;
    }

    const joinEui = this.resolveLw001JoinEui(row, profile, result);
    if (joinEui === undefined) {
      return;
    }
    const appKey = this.resolveLw001AppKey(row, profile, result);
    if (appKey === undefined) {
      return;
    }

    const nwkKey = normalizeOptionalHex32(profile.csNwkKey ?? '');
    if (!nwkKey) {
      result.errors.push(
        this.buildImportIssueForLw001Row(
          ImportLw001Reason.NWK_KEY_INVALID,
          row,
          normalizedDeveui,
        ),
      );
      return;
    }

    const existingDevice = await this.deviceRepository.findOptionalByDevEuiAndTenantId(
      normalizedDeveui,
      idTenant,
    );
    const isDuplicateInFile = seenDeveuisInFile.has(normalizedDeveui);
    seenDeveuisInFile.add(normalizedDeveui);

    const deviceName = await this.resolveLw001DeviceNameForTenant(
      normalizedDeveui,
      idTenant,
      existingDevice?.id,
    );
    const tags = { idTenant };

    try {
      if (existingDevice || isDuplicateInFile) {
        const target =
          existingDevice
          ?? (await this.deviceRepository.findOptionalByDevEuiAndTenantId(
            normalizedDeveui,
            idTenant,
          ));
        if (!target) {
          result.errors.push(
            this.buildImportIssueForLw001Row(
              ImportLw001Reason.ROW_PROCESS_FAILED,
              row,
              normalizedDeveui,
              'Device not found for update',
            ),
          );
          return;
        }
        await this.persistLw001UpdatedDevice(
          target,
          deviceName,
          profile,
          joinEui,
          appKey,
          nwkKey,
          tags,
          normalizedDeveui,
        );
        result.updated++;
        const warningReason = isDuplicateInFile
          ? ImportLw001Reason.DEVEUI_DUPLICATE_IN_FILE_UPDATED
          : ImportLw001Reason.DEVEUI_ALREADY_EXISTS_UPDATED;
        result.warnings.push(
          this.buildImportIssueForLw001Row(
            warningReason,
            row,
            normalizedDeveui,
            normalizedDeveui,
          ),
        );
      } else {
        await this.persistLw001NewDevice(
          normalizedDeveui,
          deviceName,
          profile,
          joinEui,
          appKey,
          nwkKey,
          tags,
          idTenant,
        );
        result.created++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(
        this.buildImportIssueForLw001Row(
          ImportLw001Reason.ROW_PROCESS_FAILED,
          row,
          normalizedDeveui,
          message,
        ),
      );
    }
  }

  private async resolveLw001ProfileForRow(
    row: Lw001ParsedRow,
    idTenant: string,
    defaultProfile: DeviceProfile | null,
    result: ImportDevicesResultDto,
  ): Promise<DeviceProfile | null> {
    const columnProfileId = row.idDeviceProfile.trim();
    if (columnProfileId) {
      if (!isValidUuid(columnProfileId)) {
        result.errors.push(
          this.buildImportIssueForLw001Row(
            ImportLw001Reason.DEVICE_PROFILE_ID_INVALID,
            row,
          ),
        );
        return null;
      }
      const profile = await this.deviceProfileRepository.findOptionalByIdAndTenant(
        columnProfileId,
        idTenant,
      );
      if (!profile) {
        result.errors.push(
          this.buildImportIssueForLw001Row(
            ImportLw001Reason.DEVICE_PROFILE_ID_INVALID,
            row,
          ),
        );
        return null;
      }
      return profile;
    }
    if (!defaultProfile) {
      result.errors.push(
        this.buildImportIssueForLw001Row(
          ImportLw001Reason.DEVICE_PROFILE_ID_REQUIRED,
          row,
        ),
      );
      return null;
    }
    return defaultProfile;
  }

  private resolveLw001JoinEui(
    row: Lw001ParsedRow,
    profile: DeviceProfile,
    result: ImportDevicesResultDto,
  ): string | undefined {
    const resolved = resolveLw001JoinEuiValue(row.joineui, profile.csJoineui);
    if (!resolved.ok) {
      result.errors.push(
        this.buildImportIssueForLw001Row(resolved.reason, row),
      );
      return undefined;
    }
    return resolved.value;
  }

  private resolveLw001AppKey(
    row: Lw001ParsedRow,
    profile: DeviceProfile,
    result: ImportDevicesResultDto,
  ): string | undefined {
    const resolved = resolveLw001AppKeyValue(row.appKey, profile.csAppKey);
    if (!resolved.ok) {
      result.errors.push(
        this.buildImportIssueForLw001Row(resolved.reason, row),
      );
      return undefined;
    }
    return resolved.value;
  }

  private async resolveLw001DeviceNameForTenant(
    deveuiLower: string,
    idTenant: string,
    excludeDeviceId?: string,
  ): Promise<string> {
    let name = buildLw001DeviceName(deveuiLower, false);
    const conflict = await this.deviceRepository.findOptionalByNameAndTenantId(
      name,
      idTenant,
    );
    if (conflict && conflict.id !== excludeDeviceId) {
      name = buildLw001DeviceName(deveuiLower, true);
    }
    return name;
  }

  private async persistLw001NewDevice(
    deveui: string,
    name: string,
    profile: DeviceProfile,
    joinEui: string,
    appKey: string,
    nwkKey: string,
    tags: Record<string, string>,
    idTenant: string,
  ): Promise<Device> {
    const createDeviceDto: CreateDeviceDto = {
      idTenant,
      idDeviceProfile: profile.id,
      deveui,
      name,
      description: '',
      csApplicationId: profile.csApplicationId,
      csJoineui: joinEui,
      csAppKey: appKey,
      csNwkKey: nwkKey,
      tags,
      variables: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const deviceChirpstack: ChirpstackDeviceInterface = {
      applicationId: profile.csApplicationId,
      description: '',
      devEui: deveui,
      deviceProfileId: profile.idChipstack,
      isDisabled: false,
      joinEui,
      name,
      skipFcntCheck: false,
      tags,
      variables: {},
    };
    const deviceKeys: ChirpstackDeviceKeysInterface = {
      appKey,
      nwkKey,
    };
    return await this.createDevice(
      createDeviceDto,
      profile,
      deviceChirpstack,
      deviceKeys,
    );
  }

  private async persistLw001UpdatedDevice(
    device: Device,
    name: string,
    profile: DeviceProfile,
    joinEui: string,
    appKey: string,
    nwkKey: string,
    tags: Record<string, string>,
    deveui: string,
  ): Promise<Device> {
    const updateDeviceDto: UpdateDeviceDto = {
      idDeviceProfile: profile.id,
      deveui,
      name,
      description: device.description ?? '',
      csApplicationId: profile.csApplicationId,
      csJoineui: joinEui,
      csAppKey: appKey,
      csNwkKey: nwkKey,
      tags,
      variables: device.variables ?? {},
      updatedAt: new Date(),
    };
    return await this.updateWithDevice(device, updateDeviceDto);
  }

  private buildImportIssue(
    reason: string,
    row: number,
    deveui?: string,
    detail?: string,
  ): ImportDeviceRowIssueDto {
    return {
      reason,
      row,
      deveui,
      detail,
    };
  }

  private buildImportIssueForLw001Row(
    reason: string,
    row: Lw001ParsedRow,
    deveuiOverride?: string,
    detail?: string,
  ): ImportDeviceRowIssueDto {
    const deveui = deveuiOverride ?? row.devEui.trim();
    const sheetDetail = row.sheetName ? `sheet=${row.sheetName}` : undefined;
    const mergedDetail = [sheetDetail, detail].filter((part) => part && part.length > 0).join('; ');
    return this.buildImportIssue(reason, row.rowNumber, deveui, mergedDetail || undefined);
  }

} 