import { Injectable, NotFoundException, Logger, BadRequestException, InternalServerErrorException, HttpException, HttpStatus, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Cattle } from '../entities/cattle.entity';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';
import { SyncAnimalSimpleEventDto, SyncAnimalSimpleEventResultDto } from 'src/modules/massive-events/dto/sync-animal-simple-event.dto';
import { CattleBasicQueryDto } from '../dto/cattle-basic-query.dto';
import { ApplySimpleEventsResponseDto } from 'src/modules/massive-events/dto/apply-simple-events-response.dto';
import { CattleRepository } from '../repositories/cattle.repository';
import { CattleDeviceHistoryRepository } from '../repositories/cattle-device-history.repository';
import { CattleWeightHistoryRepository } from '../repositories/cattle-weight-history.repository';
import { CattleEartagHistoryRepository } from '../repositories/cattle-eartag-history.repository';
import { CattleMedicationHistoryRepository } from '../repositories/cattle-medication-history.repository';
import { MassiveEventService } from 'src/modules/massive-events/services/massive-event.service';
import { SimpleEventService } from 'src/modules/massive-events/services/simple-event.service';
import { AnimalSimpleEventRepository } from 'src/modules/massive-events/repositories/animal-simple-event.repository';
import { DevicesService } from '../../production-center/services/devices.service';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import { SimpleEventType } from 'src/modules/massive-events/enums/simple-event-type.enum';
import { AnimalSimpleEvent } from 'src/modules/massive-events/entities/animal-simple-event.entity';
import { Type } from 'class-transformer';
import { ColorRepository } from '../repositories/color.repository';
import { CharacteristicRepository } from '../repositories/characteristic.repository';
import { CattleCharacteristicRepository } from '../repositories/cattle-characteristic.repository';
import { WeightContext } from '../entities/cattle-weight-history.entity';

@Injectable()
export class CattleService {

  private readonly logger: Logger = new Logger(CattleService.name);

  constructor(
    private readonly cattleRepository: CattleRepository,
    private readonly cattleDeviceHistoryRepository: CattleDeviceHistoryRepository,
    private readonly cattleWeightHistoryRepository: CattleWeightHistoryRepository,
    private readonly cattleEartagHistoryRepository: CattleEartagHistoryRepository,
    private readonly cattleMedicationHistoryRepository: CattleMedicationHistoryRepository,
    private readonly colorRepository: ColorRepository,
    private readonly characteristicRepository: CharacteristicRepository,
    private readonly cattleCharacteristicRepository: CattleCharacteristicRepository,
    private readonly deviceService: DevicesService,
    private readonly animalSimpleEventRepository: AnimalSimpleEventRepository,
    private readonly dataSource: DataSource,
    private readonly massiveEventService: MassiveEventService,
    private readonly simpleEventService: SimpleEventService,
  ) { }

  /*async createCattle(idTenant: string, idCurrentUser: string, cattleData: any, manager: EntityManager) {
    const cattle = await this.cattleRepository.findBySysNumberAndTenantId(idTenant, cattleData.number, manager);
    if (!cattle) {
      const cattle = await this.cattleRepository.saveWithManager(manager, {
        id: crypto.randomUUID(),
        idTenant,
        sysNumber: cattleNumber,
        createdAt: new Date(),
        applicreatedAtedBy: idCurrentUser,
      });
    }


  }*/

  /**
   * Apply multiple simple events to cattle by their number
   * @param idTenant - The tenant ID
   * @param events - The events to apply
   * @param appliedBy - The user who applied the events
   * @returns The cattle with the events applied
   */
  async applyBulkSimpleEvents(
    idTenant: string,
    idCurrentUser: string,
    events: Array<{
      cattleNumber: string;
      type: SimpleEventType;
      data: any;
      appliedBy?: string;
      idMassiveEvent: string;
      idSimpleEvent: string;
    }>,
  ): Promise<Cattle[]> {
    return this.dataSource.transaction(async manager => {
      type MinimumSimpleEvent = { idSimEv: string; type: string };
      type MinimumMassiveEvents = Record<string, MinimumSimpleEvent[]>;
      var minimumMassiveEvents: MinimumMassiveEvents = {};
      const results: Cattle[] = [];
      for (const ev of events) {
        const cattle = await this.cattleRepository.findOneForUpdateByNumber(idTenant, ev.cattleNumber, manager);
        if (!cattle) {
          continue;
        }
        const massiveEvent = await this.massiveEventService.findWithSimpleEventsByIdOrFail(idTenant, ev.idMassiveEvent, manager);
        if (massiveEvent.status === 'closed') throw new HttpException('Massive event already closed', HttpStatus.UNPROCESSABLE_ENTITY); //422
        //if (massiveEvent.simpleEvents.find(se => se.id === ev.idSimpleEvent)) throw new HttpException('Simple event already applied', HttpStatus.UNPROCESSABLE_ENTITY); //422
        if (!minimumMassiveEvents[ev.idMassiveEvent]) minimumMassiveEvents[ev.idMassiveEvent] = [];
        minimumMassiveEvents[ev.idMassiveEvent].push({ idSimEv: ev.idSimpleEvent, type: ev.type });
        await this.applySingleEventToCattle(manager, idTenant, idCurrentUser, cattle, ev);
        if (ev.idMassiveEvent) {
          await this.animalSimpleEventRepository.saveWithManager(manager, {
            id: crypto.randomUUID(),
            idTenant,
            idSimpleEvent: ev.idSimpleEvent,
            idMassiveEvent: ev.idMassiveEvent,
            idAnimal: cattle.id,
            appliedAt: new Date(),
            appliedBy: ev.appliedBy ?? idCurrentUser,
          });
        }
        await this.cattleRepository.saveWithManager(manager, cattle);
        results.push(cattle);
      }

      return results;
    });
  }

  /**
   * Apply multiple simple events to a single cattle by number
   * @param idTenant - The tenant ID
   * @param cattleNumber - The cattle number
   * @param events - The events to apply
   * @param appliedBy - The user who applied the events
   * @returns The cattle with the events applied
   */
  async applyMultipleSimpleEventsByNumber_transaction(
    idTenant: string,
    idCurrentUser: string,
    cattleNumber: string,
    idMassiveEvent: string,
    events: Array<{
      type: SimpleEventType;
      data: any;
      appliedBy?: string;
      appliedAt?: Date;
      idSimpleEvent: string;
    }>,
    manager?: EntityManager,
  ): Promise<ApplySimpleEventsResponseDto[]> {
    if (manager) {
      return this.applyMultipleSimpleEventsByNumber_manager(idTenant, idCurrentUser, cattleNumber, idMassiveEvent, events, manager);
    } else {
      return this.dataSource.transaction(async manager => {
        return this.applyMultipleSimpleEventsByNumber_manager(idTenant, idCurrentUser, cattleNumber, idMassiveEvent, events, manager);
      });
    }

  }

  async applyMultipleSimpleEventsByNumber_manager(
    idTenant: string,
    idCurrentUser: string,
    cattleNumber: string,
    idMassiveEvent: string,
    events: Array<{
      type: SimpleEventType;
      data: any;
      appliedBy?: string;
      appliedAt?: Date;
      idSimpleEvent: string;
    }>,
    manager: EntityManager,
  ): Promise<ApplySimpleEventsResponseDto[]> {
    const massiveEvent = await this.massiveEventService.findWithSimpleEventsByIdOrFail(idTenant, idMassiveEvent, manager);
    if (massiveEvent.status === 'closed') throw new HttpException('Massive event already closed', HttpStatus.UNPROCESSABLE_ENTITY); //422
    const cattle = await this.cattleRepository.findOneForUpdateByNumber(idTenant, cattleNumber, manager);
    if (!cattle) throw new NotFoundException(`Cattle ${cattleNumber} not found`);
    const createdEvents: ApplySimpleEventsResponseDto[] = [];
    for (const ev of events) {
      if (ev.type === SimpleEventType.CASTRATION && cattle.castrated) {
        continue;
      }
      await this.simpleEventService.findByIdOrFail(idTenant, ev.idSimpleEvent, manager);
      await this.applySingleEventToCattle(manager, idTenant, idCurrentUser, cattle, { ...ev, idMassiveEvent: idMassiveEvent, appliedBy: ev.appliedBy ?? idCurrentUser });
      const event = await this.animalSimpleEventRepository.saveWithManager(manager, {
        id: crypto.randomUUID(),
        idTenant,
        idSimpleEvent: ev.idSimpleEvent,
        idMassiveEvent: idMassiveEvent,
        idAnimal: cattle.id,
        provisionalNumber: cattleNumber,
        appliedAt: ev.appliedAt ?? new Date(),
        appliedBy: ev.appliedBy ?? idCurrentUser,
        data: ev.data,
      });
      const responsedto: ApplySimpleEventsResponseDto = {
        ...event,
        idAnimal: cattle.id,
        type: ev.type,
        animalNumber: cattleNumber,
        data: ev.data
      }
      createdEvents.push(responsedto);
    }
    await this.cattleRepository.saveWithManager(manager, cattle);
    return createdEvents;

  }

  /**
   * Apply an event to a cattle, in this method the Cattle,simpleEvents and MassiveEvents must exist in the database
   * @param manager - The entity manager
   * @param idTenant - The tenant ID
   * @param cattle - The cattle to apply the event to
   * @param ev - The event to apply
   */
  private async applySingleEventToCattle(
    manager: EntityManager,
    idTenant: string,
    idCurrentUser: string,
    cattle: Cattle,
    ev: {
      type: SimpleEventType;
      data: any;
      appliedBy?: string;
      appliedAt?: Date;
      idMassiveEvent: string;
      idSimpleEvent: string;
    }
  ): Promise<void> {
    switch (ev.type) {
      case SimpleEventType.WEIGHT:
        cattle.lastWeight = ev.data.weight;
        const event = await this.cattleWeightHistoryRepository.createWithManager(manager, {
          idTenant: idTenant,
          idCattle: cattle.id,
          weight: ev.data.weight,
          date: ev.appliedAt ?? new Date(),
          idMassiveEvent: ev.idMassiveEvent,
          context: WeightContext.EVENT,
          recordedBy: ev.appliedBy ?? idCurrentUser,
        } as any);
        break;

      case SimpleEventType.EARTAG:
        const cattleWithSameEartag = await this.cattleRepository.findByEartag(idTenant, ev.data.eartagNumber);
        if (cattleWithSameEartag && cattleWithSameEartag.id !== cattle.id) {
          throw new ConflictException(`Eartag ${ev.data.eartagNumber} already exists for another cattle`);
        }
        cattle.eartag = ev.data.eartagNumber;
        await this.cattleEartagHistoryRepository.createWithManager(manager, {
          idTenant: idTenant,
          idCattle: cattle.id,
          eartagNumber: ev.data.eartagNumber,
          assignedAt: ev.appliedAt ?? new Date(),
          assignedBy: ev.appliedBy ?? idCurrentUser,
          idMassiveEvent: ev.idMassiveEvent,
        } as any);
        break;

      case SimpleEventType.TRACKER:
        const device = await this.deviceService.findOne(ev.data.tracker_deveui, idTenant, manager);
        if (device) {
          if (cattle.idDevice !== device.id) {
            await this.cattleDeviceHistoryRepository.unassignDeviceByidCattle(idTenant, cattle.id, manager, ev.appliedAt ?? new Date());
            await this.cattleDeviceHistoryRepository.unassignDeviceByidDevice(idTenant, device.id, manager, ev.appliedAt ?? new Date());
            await this.cattleRepository.unsetDevice(idTenant, device.id, manager);

            const tags = device.tags ?? {};
            tags.idCattle = cattle.id;
            tags.idDevice = device.id;
            tags.idTenant = idTenant;
            const deviceUpdateDto = {
              tags: tags
            };
            await this.deviceService.updateWithDevice(device, deviceUpdateDto, manager);
            cattle.idDevice = device.id;
            await this.cattleDeviceHistoryRepository.assignDeviceToCattle(
              device.id,
              cattle.id,
              idTenant,
              ev.appliedBy ?? idCurrentUser,
              ev.appliedAt ?? new Date(),
              ev.idMassiveEvent,
              manager,
            );
          }
        } else {
          throw new NotFoundException(`Device ${ev.data.tracker_deveui} not found`);
        }
        break;

      case SimpleEventType.BRAND:
        cattle.idBrand = ev.data.idBrand;
        break;

      case SimpleEventType.CASTRATION:
        if (!cattle.castrated) {
          cattle.castrated = true;
          cattle.castrationDate = ev.appliedAt ?? new Date();
          cattle.updatedAt = new Date();
        }
        break;

      case SimpleEventType.MEDICATION:
        await this.cattleMedicationHistoryRepository.createWithManager(manager, {
          idTenant: idTenant,
          idCattle: cattle.id,
          medicationName: ev.data.medicationName,
          dosage: ev.data.dosage,
          route: ev.data.route,
          lot: ev.data.lot,
          appliedAt: ev.appliedAt ?? new Date(),
          appliedBy: ev.appliedBy ?? idCurrentUser,
          idMassiveEvent: ev.idMassiveEvent,
        } as any);
        break;
    }
  }

  async syncCattleSimpleEvents(
    idTenant: string,
    idCurrentUser: string,
    events: SyncAnimalSimpleEventDto[],
  ): Promise<SyncAnimalSimpleEventResultDto[]> {
    return this.dataSource.transaction(async manager => {
      const results: SyncAnimalSimpleEventResultDto[] = [];
      for (const payload of events) {
        const cattle = await this.cattleRepository.findOneForUpdateByNumber(idTenant, payload.cattleNumber, manager);
        if (!cattle) {
          results.push({
            id: payload.id,
            status: 'failed',
            message: `Cattle ${payload.cattleNumber} not found`,
          });
          continue;
        }
        await this.applySingleEventToCattle(manager, idTenant, idCurrentUser, cattle, {
          type: payload.type as any,
          data: payload.dataJson ? JSON.parse(payload.dataJson) : {},
          appliedBy: payload.appliedBy ?? idCurrentUser,
          appliedAt: new Date(payload.appliedAt),
          idMassiveEvent: payload.idMassiveEvent,
          idSimpleEvent: payload.idSimpleEvent,
        });
        await this.animalSimpleEventRepository.saveWithManager(manager, {
          id: payload.id,
          idTenant,
          idSimpleEvent: payload.idSimpleEvent,
          idMassiveEvent: payload.idMassiveEvent,
          idAnimal: cattle.id,
          appliedAt: new Date(payload.appliedAt),
          appliedBy: payload.appliedBy ?? idCurrentUser,
          data: payload.dataJson ? JSON.parse(payload.dataJson) : {},
          provisionalNumber: payload.cattleNumber,
        });
        await this.cattleRepository.saveWithManager(manager, cattle);
        results.push({ id: payload.id, status: 'synced', animalServerId: cattle.id });
      }
      return results;
    });
  }


  /**
   * Create or update a cattle with device tags
   * @param idTenant - The tenant ID
   * @param dto - The cattle data
   * @returns The created or updated cattle
   */
  async createOrUpdateWithDeviceTags(idTenant: string, dto: CreateCattleDto, idcattle?: string): Promise<Cattle> {
    if (!dto.deveui) {
      throw new BadRequestException("El campo deveui es requerido para esta operación");
    }
    const device = await this.deviceService.findOne(dto.deveui, idTenant);
    if (!device) {
      throw new NotFoundException(`Device ${dto.deveui} not found`);
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      dto.idDevice = device.id;
      // Crear una copia del DTO sin el campo deveui
      const { deveui, ...dtoWithoutDeveui } = dto;
      let cattle: Cattle | null;
      if (idcattle) {
        cattle = await this.cattleRepository.update(idTenant, idcattle, dtoWithoutDeveui as UpdateCattleDto, manager);
      } else {
        cattle = await this.cattleRepository.create(dtoWithoutDeveui as CreateCattleDto, manager);
      }
      if (!cattle) throw new NotFoundException(`Cattle ${idcattle} not found`);
      const cattleDeviceHistory = await this.cattleDeviceHistoryRepository.assignDeviceToCattle(dto.idDevice, cattle.id, idTenant, undefined, undefined, undefined, manager);
      const deviceUpdateDto = {
        applicationId: device.csApplicationId,
        description: device.description,
        name: device.name,
        tags: { id_cattle: cattle.id, id_device: dto.idDevice }
      };
      const deviceTags = await this.deviceService.updateWithDevice(device, deviceUpdateDto, manager);
      await queryRunner.commitTransaction();
      return cattle;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException("Error saving the cattle with the device");
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create a new cattle
   * @param idTenant - The tenant ID
   * @param data - The cattle data
   * @returns The created cattle
   */
  async create(idTenant: string, data: CreateCattleDto): Promise<Cattle> {
    data.idTenant = idTenant;
    if (!data.deveui) {
      return this.cattleRepository.create(data);
    }
    return this.createOrUpdateWithDeviceTags(idTenant, data);
  }

  /**
   * Find a cattle by ID
   * @param idTenant - The tenant ID
   * @param id - The cattle ID
   * @returns The found cattle
   */
  async findByIdOrFail(idTenant: string, id: string): Promise<Cattle> {
    const cattle = await this.cattleRepository.findOne(idTenant, id);
    if (!cattle) throw new NotFoundException(`Cattle ${id} not found`);
    return cattle;
  }

  async findByNumberOrFail(idTenant: string, number: string, manager?: EntityManager): Promise<Cattle> {
    const cattle = await this.cattleRepository.findByNumberAndTenantId(idTenant, number, manager);
    if (!cattle) throw new NotFoundException(`Cattle ${number} not found`);
    return cattle;
  }

  /**
   * Update a cattle
   * @param idTenant - The tenant ID
   * @param id - The cattle ID
   * @param data - The cattle data
   * @returns The updated cattle
   */
  async update(idTenant: string, id: string, data: UpdateCattleDto): Promise<Cattle> {
    if (data.deveui) {
      return this.createOrUpdateWithDeviceTags(idTenant, data as CreateCattleDto, id);
    } else {
      const cattle = await this.cattleRepository.update(idTenant, id, data);
      if (!cattle) throw new NotFoundException(`Cattle ${id} not found`);
      return cattle;
    }
  }

  async remove(idTenant: string, id: string): Promise<void> {
    await this.cattleRepository.delete(idTenant, id);
  }

  list(idTenant: string): Promise<Cattle[]> {
    return this.cattleRepository.findAll(idTenant);
  }

  async import(file: Express.Multer.File, idTenant: string): Promise<any[]> {
    try {
      if (!file || !file.path) {
        throw new BadRequestException('No se ha proporcionado un archivo válido');
      }
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new BadRequestException('The Excel sheet does not exist or is empty');
      }
      const datos = await this.processSheet(worksheet, idTenant);
      return datos;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error processing the Excel file: ${error.message}`);
    } finally {
      if (file && file.path) {
        try {
          fs.unlink(file.path, (err) => {
            if (err) {
              this.logger.error(`Error deleting file ${file.path}: ${err.message}`);
            } else {
              this.logger.debug(`File ${file.originalname} deleted from ${file.path}`);
            }
          });
        } catch (unlinkError) {
          this.logger.error(`Error in finally block: ${unlinkError.message}`);
        }
      }
    }
  }

  async processSheet(worksheet: ExcelJS.Worksheet, idTenant: string): Promise<any> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<string>,
    };
    // Verificar si hay filas para procesar
    if (worksheet.rowCount < 2) {
      results.errors.push('El archivo Excel no contiene datos para procesar');
      return results;
    }
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
        if (rowValues.length < 24) {
          results.errors.push(`Row ${rowNumber} has not enough columns (it has ${rowValues.length} columns, it should have 24 )`);
          results.failed++;
          continue;
        }
        try {
          const cattle = await this.processExcelRow(rowValues, rowNumber, idTenant);
          results.success++;
          continue;
        } catch (error) {
          if (error instanceof BadRequestException) {
            results.errors.push(`Row ${rowNumber}: ${error.message}`);
          } else {
            results.errors.push(`Row ${rowNumber}: Error creating cattle`);
          }
          results.failed++;
        }
      } catch (error) {
        results.errors.push(`Row ${rowNumber}: ${error.message}`);
        results.failed++;
      }
    }
    this.logger.debug(`Procesamiento completado: ${results.success} éxitos, ${results.failed} fallos`);
    return results;
  }

  /**
   * Process a row of the Excel sheet
   * @param rowValues - The row values
   * @param rowNumber - The row number
   * @param idTenant - The tenant ID
   * @returns The created cattle
   */
  async processExcelRow(rowValues: any[], rowNumber: number, idTenant: string): Promise<Cattle> {
    if (!rowValues[0]) {
      throw new BadRequestException(`has no system number`);
    } else {
      const cattle = await this.cattleRepository.findBySysNumberAndTenantId(idTenant, rowValues[0]);
      if (cattle) {
        throw new BadRequestException(`system number ${rowValues[0]} already exists`);
      }
    }
    if (!rowValues[1]) {
      throw new BadRequestException(`system number ${rowValues[0]} has no cattle number`);
    } else {
      const cattle = await this.cattleRepository.findByNumberAndTenantId(idTenant, rowValues[1]);
      if (cattle) {
        throw new BadRequestException(`cattle number ${rowValues[1]} already exists`);
      }
    }
    if (!rowValues[7]) {
      throw new BadRequestException(`system number ${rowValues[0]} has no received at date`);
    }
    if (!rowValues[9]) {
      throw new BadRequestException(`system number ${rowValues[0]} has no reception weight`);
    }
    if (!rowValues[8]) {
      throw new BadRequestException(`system number ${rowValues[0]} has no purchase weight `);
    }
    if (!rowValues[23]) {
      throw new BadRequestException(`system number ${rowValues[0]} has no purchase from `);
    }
    if (!rowValues[13]) {
      throw new BadRequestException(`system number ${rowValues[0]} has no purchase price `);
    }
    const dto = new CreateCattleDto();
    dto.idTenant = idTenant;
    dto.sysNumber = rowValues[0];
    dto.number = rowValues[1];
    if (rowValues[2]) { dto.brand = rowValues[2]; }
    if (rowValues[3]) { dto.colorDescription = rowValues[3]; }
    if (rowValues[4]) { dto.colorMain = rowValues[4]; }
    if (rowValues[5]) { dto.colorFeature = rowValues[5]; }
    if (rowValues[6]) { dto.lot = rowValues[6]; }
    dto.receivedAt = rowValues[7];
    dto.receivedWeight = rowValues[9];
    dto.purchaseWeight = rowValues[8];
    if (rowValues[10]) { dto.comments = rowValues[10]; }
    dto.purchasedFrom = rowValues[23];
    dto.purchasePrice = rowValues[13];
    if (rowValues[14]) { dto.purchaseCommission = rowValues[14]; }
    if (rowValues[15]) { dto.negotiatedPricePerKg = rowValues[15]; }
    if (rowValues[17]) { dto.lotPricePerWeight = rowValues[17]; }
    // Validar y ajustar lot_price_per_weight para evitar desbordamiento
    /*if (rowValues[17]) {
      const value = parseFloat(rowValues[17]);
      if (isNaN(value)) {
        this.logger.warn(`Row ${rowNumber}, system number ${rowValues[0]} has invalid lot_price_per_weight: ${rowValues[17]}`);
        throw new BadRequestException(`system number ${rowValues[0]} has invalid lot_price_per_weight: ${rowValues[17]}`);
      } else if (value > 99999999.99) {
        this.logger.warn(`Row ${rowNumber}, system number ${rowValues[0]} has lot_price_per_weight too large: ${value}, setting to 99999999.99`);
        dto.lotPricePerWeight = 99999999.99;
      } else {
        dto.lotPricePerWeight = value;
      }
    }*/
    if (rowValues[22]) { dto.averageGr = rowValues[22]; }
    if (rowValues[21]) { dto.saleWeight = rowValues[21]; }
    if (rowValues[34]) { dto.salePricePerKg = rowValues[34]; }
    if (rowValues[36]) { dto.salePrice = rowValues[36]; }
    try {
      const cattle = await this.cattleRepository.create(dto);
      return cattle;
    } catch (error) {
      this.logger.error(error);
      this.logger.debug(`Row ${rowNumber}, system number ${rowValues[0]} has error creating cattle. ${error.message}`);
      throw new BadRequestException(`system number ${rowValues[0]} has error creating cattle.`);
    }
  }

  // New methods for Create Sale workflow

  /**
   * Validate cattle by number for sale - only allows ACTIVE status
   * @param number - Cattle number
   * @param idTenant - Tenant ID
   * @returns Cattle if valid and ACTIVE
   * @throws BadRequestException if not found or not ACTIVE
   */
  async validateCattleByNumber(number: string, idTenant: string) {
    const cattle = await this.cattleRepository.findByNumberAndTenantId(idTenant, number);

    if (!cattle) {
      throw new BadRequestException(`Cattle with number ${number} not found for this tenant`);
    }

    if (cattle.status !== 'ACTIVE') {
      let message = `Cattle ${number} cannot be added to sale. `;
      if (cattle.status === 'SOLD') {
        message += 'This cattle has already been sold.';
      } else if (cattle.status === 'DEAD') {
        message += 'This cattle is marked as dead.';
      } else if (cattle.status === 'LOST') {
        message += 'This cattle is marked as lost.';
      } else {
        message += `Status: ${cattle.status}`;
      }
      throw new BadRequestException(message);
    }

    return cattle;
  }

  /**
   * Record weight measurement in history
   * @param cattleId - Cattle ID
   * @param dto - Weight record data
   * @param idTenant - Tenant ID
   * @param userId - User ID who recorded
   */
  async recordWeightHistory(cattleId: string, dto: any, idTenant: string, userId?: string) {
    const cattle = await this.cattleRepository.findOne(idTenant, cattleId);
    if (!cattle) {
      throw new NotFoundException('Cattle not found');
    }

    // Create weight history using repository (no need for full entity)
    const weightHistory = {
      idCattle: cattleId,
      weight: dto.weight,
      date: new Date(dto.measuredDate || new Date()),
      recordedBy: userId,
      idTenant,
    };

    return this.cattleWeightHistoryRepository.create(weightHistory as any);
  }

  /**
   * Update cattle current weight
   * @param cattleId - Cattle ID
   * @param weight - New weight
   * @param idTenant - Tenant ID
   */
  async updateCattleWeight(cattleId: string, weight: number, idTenant: string) {
    const cattle = await this.cattleRepository.findOne(idTenant, cattleId);
    if (!cattle) {
      throw new NotFoundException('Cattle not found');
    }

    await this.cattleRepository.update(idTenant, cattleId, { lastWeight: weight } as any);
    return { success: true, message: 'Weight updated successfully' };
  }

  /**
   * Bulk update cattle status
   * @param cattleIds - Array of cattle IDs
   * @param status - New status
   * @param idTenant - Tenant ID
   */
  async bulkUpdateStatus(cattleIds: string[], status: string, idTenant: string): Promise<BulkStatusUpdateResult> {
    const results: StatusResult[] = [];

    for (const id of cattleIds) {
      try {
        const cattle = await this.cattleRepository.findOne(idTenant, id);
        if (cattle) {
          await this.cattleRepository.update(idTenant, id, { status } as any);
          results.push({ id, success: true });
        } else {
          results.push({ id, success: false, error: 'Cattle not found' });
        }
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }

    return {
      totalProcessed: cattleIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  async getBasicInfo(idTenant: string): Promise<Cattle[]> {
    return this.cattleRepository.getBasicInfo(idTenant);
  }

  async getBasicInfoPaged(idTenant: string, query: CattleBasicQueryDto) {
    const { limit, cursor, updated_after } = query;
    const updatedAfter = updated_after ? new Date(updated_after) : undefined;
    return this.cattleRepository.getBasicInfoPaged({
      idTenant,
      limit,
      cursor,
      updatedAfter,
    });
  }

  /**
   * Recibir UNA res dentro de una recepción:
   * - Verifica recepción y deriva purchaseId + massEventId.
   * - Reserva número seguro (salta colisiones activas).
   * - Asigna color (por id o por nombre creando si no existe).
   * - Asocia características (N:M).
   * - Aplica simple events a la res (vinculados al massive_event de la recepción).
   * - Asigna lote opcional y recalcula métricas del lote (si aplica).
   * Todo en UNA transacción.
   */
  /*async receiveOneFromReception(params: {
    tenantId: string;
    userId: string;
    receptionId: string;
    dto: ReceiveCattleDto;
  }): Promise<ReceiveCattleResponseDto> {
    const { tenantId, userId, receptionId, dto } = params;

    return this.dataSource.transaction(async (m) => {
      // 1) Cargar la recepción y derivar batch/purchase/evento masivo
      const prRepo = m.getRepository(PurchaseReception);
      const rec = await prRepo.findOne({
        where: { id: receptionId },
        relations: ['batch', 'batch.purchase', 'batch.massiveEvent', 'batch.purchase.idTenant'],
      });
      if (!rec) throw new NotFoundException('Recepción no encontrada');
      if ((rec.batch.purchase as any).idTenant?.id !== tenantId) {
        throw new ForbiddenException('Acceso a recepción de otro tenant');
      }
      if (rec.status !== ReceptionDocStatus.DRAFT && rec.status !== ReceptionDocStatus.CONFIRMED) {
        throw new BadRequestException('La recepción no admite intake en su estado actual');
      }

      const purchaseId = (rec.batch.purchase as any).id as string;
      const massEventId = (rec.batch.massiveEvent as any).id as string;

      // 2) Resolver COLOR (id > nombre > ninguno)
      let colorId: string | undefined = dto.colorId;
      if (!colorId && dto.colorName?.trim()) {
        const color = await this.colorRepository.getOrCreateByNameCI(tenantId, dto.colorName.trim(), m);
        colorId = color.id;
      }

      // 3) Crear CATTLE con número seguro (salta duplicados activos)
      const { entity: cattle, numberAssigned } = await this.cattleRepository.createActiveWithAutoNumber({
        tenantId,
        baseNumber: dto.number,
        payload: {
          idPurchase: { id: purchaseId } as any,
          idLot: dto.lotId ? ({ id: dto.lotId } as any) : null,
          receivedAt: new Date(),                    // o parsear dto si lo agregas
          receivedWeight: dto.weightKg,
          purchaseWeight: dto.weightKg,              // mismo valor a la entrada
          castrated: dto.castrated ?? false,
          eartag: dto.eartag ?? null,
          comments: dto.comments ?? null,
          color: colorId ? ({ id: colorId } as any) : null, // FK id_color
        } as any,
      }, m);

      // 4) Características (N:M)
      if (dto.characteristicsIds?.length) {
        // Valida que las características pertenezcan al tenant
        const found = await this.characteristicRepository.findManyByTenantAndIds(tenantId, dto.characteristicsIds, m);
        const foundIds = new Set(found.map((x) => x.id));
        const invalid = dto.characteristicsIds.filter((id) => !foundIds.has(id));
        if (invalid.length) {
          throw new BadRequestException(`Características inválidas o de otro tenant: ${invalid.join(', ')}`);
        }
        await this.cattleCharacteristicRepository.attachMany(cattle.id, tenantId, dto.characteristicsIds, m);
      }

      // 5) Simple events (si vienen)
      if (dto.simpleEventIds?.length) {
        const rows = dto.simpleEventIds.map((idSimple) => ({
          idTenant: { id: tenantId } as any,
          idMassiveEvent: { id: massEventId } as any,
          idSimpleEvent: { id: idSimple } as any,
          idAnimal: { id: cattle.id } as any,
          appliedBy: { id: userId } as any,
          data: null,
        }));
        await this.animalSimpleEventRepository.insertMany(rows, m); // crea un helper insertMany en tu repo
      }

      // 6) Asignación de lote opcional y métrica (si la pasaste ya lo pusimos en payload;
      //    si quisieras soporte de PATCH posterior, usa cattleRepository.assignLot)

      // 7) Siguiente sugerido
      const nextSuggestion = (BigInt(numberAssigned) + 1n).toString();

      return { cattleId: cattle.id, numberAssigned, nextSuggestion };
    });
  }*/

}

// Export types for controller
export interface StatusResult {
  id: string;
  success: boolean;
  error?: string;
}

export interface BulkStatusUpdateResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: StatusResult[];
}