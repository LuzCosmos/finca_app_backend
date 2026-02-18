import { Injectable, NotFoundException, Logger, BadRequestException, InternalServerErrorException, HttpException, HttpStatus, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Cattle, CattleStatus } from '../entities/cattle.entity';
import { Device } from 'src/modules/production-center/entities/device.entity';
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
import { CattleListQueryDto } from '../dto/cattle-list.query.dto';
import { MassiveEventService } from 'src/modules/massive-events/services/massive-event.service';
import { SimpleEventService } from 'src/modules/massive-events/services/simple-event.service';
import { AnimalSimpleEventRepository } from 'src/modules/massive-events/repositories/animal-simple-event.repository';
import { DevicesService } from '../../production-center/services/devices.service';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import { SimpleEventType } from 'src/modules/massive-events/enums/simple-event-type.enum';
import { CattleCharacteristicRepository } from '../repositories/cattle-characteristic.repository';
import { CattleCharacteristic } from '../entities/cattle-characteristic.entity';
import { CattleWeightHistory, WeightContext } from '../entities/cattle-weight-history.entity';
import { CreateCattleMedicationHistoryDto } from '../dto/create-cattle-medication-history.dto';
import { CattleMedicationHistory } from '../entities/cattle-medication-history.entity';
import { LotService } from 'src/modules/commerce/services/lot.service';

@Injectable()
export class CattleService {

  private readonly logger: Logger = new Logger(CattleService.name);

  constructor(
    private readonly cattleRepository: CattleRepository,
    private readonly cattleDeviceHistoryRepository: CattleDeviceHistoryRepository,
    private readonly cattleWeightHistoryRepository: CattleWeightHistoryRepository,
    private readonly cattleEartagHistoryRepository: CattleEartagHistoryRepository,
    private readonly cattleMedicationHistoryRepository: CattleMedicationHistoryRepository,
    private readonly cattleCharacteristicRepository: CattleCharacteristicRepository,
    private readonly deviceService: DevicesService,
    private readonly animalSimpleEventRepository: AnimalSimpleEventRepository,
    private readonly dataSource: DataSource,
    private readonly massiveEventService: MassiveEventService,
    private readonly simpleEventService: SimpleEventService,
  ) { }

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
        this.validateStatusForApplyEvents(cattle.status);
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
    cattle?: Cattle,
  ): Promise<ApplySimpleEventsResponseDto[]> {
    const massiveEvent = await this.massiveEventService.findWithSimpleEventsByIdOrFail(idTenant, idMassiveEvent, manager);
    if (massiveEvent.status === 'closed') throw new HttpException('Massive event already closed', HttpStatus.UNPROCESSABLE_ENTITY); //422
    const cattleEntity = cattle ?? await this.cattleRepository.findOneForUpdateByNumber(idTenant, cattleNumber, manager);
    if (!cattleEntity) throw new NotFoundException(`Cattle ${cattleNumber} not found`);
    this.validateStatusForApplyEvents(cattleEntity.status);
    const createdEvents: ApplySimpleEventsResponseDto[] = [];
    for (const ev of events) {
      if (ev.type === SimpleEventType.CASTRATION && cattleEntity.castrated) {
        continue;
      }
      await this.simpleEventService.findByIdOrFail(idTenant, ev.idSimpleEvent, manager);
      await this.applySingleEventToCattle(manager, idTenant, idCurrentUser, cattleEntity, { ...ev, idMassiveEvent: idMassiveEvent, appliedBy: ev.appliedBy ?? idCurrentUser });
      const event = await this.animalSimpleEventRepository.saveWithManager(manager, {
        id: crypto.randomUUID(),
        idTenant,
        idSimpleEvent: ev.idSimpleEvent,
        idMassiveEvent: idMassiveEvent,
        idAnimal: cattleEntity.id,
        provisionalNumber: cattleNumber,
        appliedAt: ev.appliedAt ?? new Date(),
        appliedBy: ev.appliedBy ?? idCurrentUser,
        data: ev.data,
      });
      const responsedto: ApplySimpleEventsResponseDto = {
        ...event,
        idAnimal: cattleEntity.id,
        type: ev.type,
        animalNumber: cattleNumber,
        data: ev.data
      }
      createdEvents.push(responsedto);
    }
    await this.cattleRepository.saveWithManager(manager, cattleEntity);
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
    this.validateStatusForApplyEvents(cattle.status);
    switch (ev.type) {
      case SimpleEventType.WEIGHT:
        cattle.lastWeight = ev.data.weight;
        cattle.updatedAt = new Date();
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
        const nextEartagLeft = ev.data.eartagLeft ?? null;
        const nextEartagRight = ev.data.eartagRight ?? null;

        if (nextEartagLeft) {
          const cattleWithSameEartagLeft = await this.cattleRepository.findByAnyEartag(idTenant, nextEartagLeft, manager);
          if (cattleWithSameEartagLeft && cattleWithSameEartagLeft.id !== cattle.id) {
            throw new ConflictException(`Eartag ${nextEartagLeft} already exists for another cattle`);
          }
          cattle.eartagLeft = nextEartagLeft;
          await this.cattleEartagHistoryRepository.createWithManager(manager, {
            idTenant: idTenant,
            idCattle: cattle.id,
            data: { eartagLeft: nextEartagLeft },
            assignedAt: ev.appliedAt ?? new Date(),
            assignedBy: ev.appliedBy ?? idCurrentUser,
            idMassiveEvent: ev.idMassiveEvent,
          } as any);
        }

        if (nextEartagRight) {
          const cattleWithSameEartagRight = await this.cattleRepository.findByAnyEartag(idTenant, nextEartagRight, manager);
          if (cattleWithSameEartagRight && cattleWithSameEartagRight.id !== cattle.id) {
            throw new ConflictException(`Eartag ${nextEartagRight} already exists for another cattle`);
          }
          cattle.eartagRight = nextEartagRight;
          await this.cattleEartagHistoryRepository.createWithManager(manager, {
            idTenant: idTenant,
            idCattle: cattle.id,
            data: { eartagRight: nextEartagRight },
            assignedAt: ev.appliedAt ?? new Date(),
            assignedBy: ev.appliedBy ?? idCurrentUser,
            idMassiveEvent: ev.idMassiveEvent,
          } as any);
        }

        if (!nextEartagLeft && !nextEartagRight) {
          break;
        }
        cattle.updatedAt = new Date();
        break;

      case SimpleEventType.TRACKER:
        let device;
        if (ev.data.tracker_id) {
          device = await this.deviceService.findById(ev.data.tracker_id, idTenant, manager);
        } else {
          device = await this.deviceService.findOne(ev.data.tracker_deveui, idTenant, manager);
        }

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
            cattle.updatedAt = new Date();
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
          throw new NotFoundException(`Device ${ev.data.tracker_deveui ?? ev.data.tracker_id} not found`);
        }
        break;

      case SimpleEventType.BRAND:
        cattle.idBrand = ev.data.idBrand;
        cattle.updatedAt = new Date();
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
    await manager.save(Cattle, cattle);
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
        try {
          this.validateStatusForApplyEvents(cattle.status);
        } catch (error) {
          results.push({
            id: payload.id,
            status: 'failed',
            message: `Cattle ${payload.cattleNumber} status is not valid for apply events`,
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
   * Create a new cattle
   * @param idTenant - The tenant ID
   * @param data - The cattle data
   * @param idCurrentUser - The current user ID
   * @returns The created cattle
   */
  async create(idTenant: string, data: CreateCattleDto, idCurrentUser: string): Promise<Cattle> {
    return this.dataSource.transaction(async (trxManager) => {
      data.idTenant = idTenant;
      var device: Device | null = null;
      if (data.idDevice) {
        await this.cattleDeviceHistoryRepository.unassignDeviceByidDevice(idTenant, data.idDevice, trxManager, new Date());
        await this.cattleRepository.unsetDevice(idTenant, data.idDevice, trxManager);
        device = await this.deviceService.findById(data.idDevice, idTenant, trxManager);
        if (!device) {
          throw new NotFoundException(`Device ${data.idDevice} not found`);
        }
      }
      if (data.birthDateAprx) {
        (data as any).birthDateAprx = new Date(data.birthDateAprx);
      }
      const cattle = await this.cattleRepository.create(data, trxManager);
      if (data.characteristics) {
        await this.updateCharacteristics(cattle.id, data.characteristics, idTenant, trxManager);
      }
      if (device) {
        const tags = device.tags ?? {};
        tags.idCattle = cattle.id;
        tags.idDevice = device.id;
        tags.idTenant = idTenant;
        const deviceUpdateDto = {
          tags: tags
        };
        device = await this.deviceService.updateWithDevice(device, deviceUpdateDto, trxManager);
        await this.cattleDeviceHistoryRepository.assignDeviceToCattle(
          device.id,
          cattle.id,
          idTenant,
          idCurrentUser,
          new Date(),
          undefined,
          trxManager,
        );
        cattle.device = device;
      }
      return cattle;
    });
  }

  /**
   * Find a cattle by ID
   * @param idTenant - The tenant ID
   * @param id - The cattle ID
   * @returns The found cattle
   */
  async findByIdOrFail(idTenant: string, id: string, manager?: EntityManager): Promise<Cattle> {
    const cattle = await this.cattleRepository.findOne(idTenant, id, manager);
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
  async update(idTenant: string, id: string, data: UpdateCattleDto, idCurrentUser: string): Promise<any> {
    this.logger.log(data);
    return this.dataSource.transaction(async (trxManager) => {
      const oldCattle = await this.findByIdOrFail(idTenant, id, trxManager);
      if (!((data.status == CattleStatus.ACTIVE && oldCattle.status == CattleStatus.LOST)
        || (data.status == CattleStatus.DEAD && oldCattle.status == CattleStatus.LOST)
        || (data.status == CattleStatus.ACTIVE && oldCattle.status == CattleStatus.DEAD))) {
        this.validateStatusForApplyEvents(oldCattle.status);
      }
      const { characteristics, ...updateD } = data;
      const updateData = { updatedAt: new Date(), ...updateD };
      this.logger.log(updateData);
      if (characteristics) {
        await this.updateCharacteristics(id, characteristics, idTenant, trxManager);
      }
      if (updateData.idDevice) {
        await this.cattleDeviceHistoryRepository.unassignDeviceByidDevice(idTenant, updateData.idDevice, trxManager, new Date());
        await this.cattleRepository.unsetDevice(idTenant, updateData.idDevice, trxManager);
        const device = await this.deviceService.findById(updateData.idDevice, idTenant, trxManager);
        if (device) {
          const tags = device.tags ?? {};
          tags.idCattle = id;
          tags.idDevice = device.id;
          tags.idTenant = idTenant;
          const deviceUpdateDto = {
            tags: tags
          };
          await this.deviceService.updateWithDevice(device, deviceUpdateDto, trxManager);
          await this.cattleDeviceHistoryRepository.assignDeviceToCattle(
            device.id,
            id,
            idTenant,
            idCurrentUser,
            new Date(),
            undefined,
            trxManager,
          );
        } else {
          throw new NotFoundException(`Device ${updateData.idDevice} not found`);
        }
      }

      if (updateData.number) {
        let cattle = await this.cattleRepository.findByNumberAndTenantId(idTenant, updateData.number, trxManager);
        if (cattle && (cattle.status === CattleStatus.ACTIVE || cattle.status === CattleStatus.LOST) && cattle.id != id) {
          throw new ConflictException('Cattle with number ' + updateData.number + ' already exists');
        }
      }
      if (updateData.eartagLeft) {
        const cattle = await this.cattleRepository.findByAnyEartag(idTenant, updateData.eartagLeft, trxManager);
        if (cattle && (cattle.status === CattleStatus.ACTIVE || cattle.status === CattleStatus.LOST) && cattle.id != id) {
          throw new ConflictException(`Eartag ${updateData.eartagLeft} already exists for another cattle`);
        }
      }
      if (updateData.eartagRight) {
        const cattle = await this.cattleRepository.findByAnyEartag(idTenant, updateData.eartagRight, trxManager);
        if (cattle && (cattle.status === CattleStatus.ACTIVE || cattle.status === CattleStatus.LOST) && cattle.id != id) {
          throw new ConflictException(`Eartag ${updateData.eartagRight} already exists for another cattle`);
        }
      }
      await this.cattleRepository.update(idTenant, id, updateData, trxManager);
      /*if (updateData.purchaseWeight) {
        const cwhs = await this.cattleWeightHistoryRepository.findByCattle(idTenant, id, trxManager, WeightContext.PURCHASE);
        if (cwhs.length > 0) {
          cwhs[0].weight = updateData.purchaseWeight;
          await this.cattleWeightHistoryRepository.update(cwhs[0], trxManager);
        } else {
          const cwh = new CattleWeightHistory();
          cwh.idTenant = idTenant;
          cwh.idCattle = id;
          cwh.weight = updateData.purchaseWeight;
          cwh.date = new Date();
          cwh.context = WeightContext.PURCHASE;
          await this.cattleWeightHistoryRepository.create(cwh, trxManager);
        }
      }*/
      if (updateData.lastWeight) {
        const cwh = new CattleWeightHistory();
        cwh.idTenant = idTenant;
        cwh.idCattle = id;
        cwh.weight = updateData.lastWeight;
        cwh.date = new Date();
        cwh.context = WeightContext.MANUAL;
        await this.cattleWeightHistoryRepository.create(cwh, trxManager);
      }
      if (updateData.receivedWeight) {
        var cwhs = await this.cattleWeightHistoryRepository.findByCattle(idTenant, id, trxManager, WeightContext.RECEIVED);
        if (cwhs.length > 0) {
          cwhs[0].weight = updateData.receivedWeight;
          await this.cattleWeightHistoryRepository.update(cwhs[0], trxManager);
        } else {
          const cwh = new CattleWeightHistory();
          cwh.idTenant = idTenant;
          cwh.idCattle = id;
          cwh.weight = updateData.receivedWeight;
          cwh.date = new Date();
          cwh.context = WeightContext.RECEIVED;
          await this.cattleWeightHistoryRepository.create(cwh, trxManager);
        }
      }
      if (updateData.saleWeight) {
        var cwhs = await this.cattleWeightHistoryRepository.findByCattle(idTenant, id, trxManager, WeightContext.SALE);
        if (cwhs.length > 0) {
          cwhs[0].weight = updateData.saleWeight;
          await this.cattleWeightHistoryRepository.update(cwhs[0], trxManager);
        } else {
          const cwh = new CattleWeightHistory();
          cwh.idTenant = idTenant;
          cwh.idCattle = id;
          cwh.weight = updateData.saleWeight;
          cwh.date = new Date();
          cwh.context = WeightContext.SALE;
          await this.cattleWeightHistoryRepository.create(cwh, trxManager);
        }
      }
      // Get the updated cattle
      const updatedCattle = await this.findByIdOrFail(idTenant, id, trxManager);
      // Fetch histories to return the complete object
      const [weightHistory, medicationHistory] = await Promise.all([
        this.cattleWeightHistoryRepository.findByCattle(idTenant, id, trxManager),
        this.cattleMedicationHistoryRepository.findByCattle(idTenant, id, trxManager),
      ]);
      return {
        ...updatedCattle,
        weightHistory,
        medicationHistory,
      };
    });
  }

  private async updateCharacteristics(idCattle: string, characteristics: string[], idTenant: string, manager?: EntityManager): Promise<void> {
    if (manager) {
      await this.updateCharacteristicsWithManager(idCattle, characteristics, idTenant, manager);
      return;
    }
    return this.dataSource.transaction(async (trxManager) => {
      await this.updateCharacteristicsWithManager(idCattle, characteristics, idTenant, trxManager);
    });
  }

  private async updateCharacteristicsWithManager(idCattle: string, characteristics: string[], idTenant: string, manager: EntityManager): Promise<void> {
    if (!characteristics?.length) {
      await manager.delete(CattleCharacteristic, { idCattle });
      return;
    }

    // Validation Logic
    const counts = {
      HEAD: 0,
      BELLY: 0,
      LEGS: 0,
      FEET: 0,
      HALF_HEAD: 0,
      SPOTS: 0,
      PATTERN: 0,
    };

    for (const char of characteristics) {
      if (char.includes('HALF_HEAD')) counts.HALF_HEAD++;
      else if (char.includes('HEAD')) counts.HEAD++;
      else if (char.includes('BELLY')) counts.BELLY++;
      else if (char.includes('LEGS')) counts.LEGS++;
      else if (char.includes('FEET')) counts.FEET++;
      else if (char.includes('SPOTS')) counts.SPOTS++;
      else if (char.includes('PATTERN')) counts.PATTERN++;
    }

    if (counts.HEAD > 1) throw new BadRequestException('Cannot have more than 1 Head characteristic');
    if (counts.BELLY > 1) throw new BadRequestException('Cannot have more than 1 Belly characteristic');
    if (counts.LEGS > 1) throw new BadRequestException('Cannot have more than 1 Legs characteristic');
    if (counts.FEET > 1) throw new BadRequestException('Cannot have more than 1 Feet characteristic');
    if (counts.SPOTS > 1) throw new BadRequestException('Cannot have more than 1 Spots characteristic');
    if (counts.PATTERN > 1) throw new BadRequestException('Cannot have more than 1 Pattern characteristic');
    if (counts.HALF_HEAD > 2) throw new BadRequestException('Cannot have more than 2 Half Head characteristics');

    await manager.delete(CattleCharacteristic, { idCattle });

    const newChars = characteristics.map((char) => {
      const entity = new CattleCharacteristic();
      entity.idCattle = idCattle;
      entity.characteristic = char as any;
      entity.idTenant = { id: idTenant } as any;
      return entity;
    });
    await manager.save(CattleCharacteristic, newChars);
  }

  async remove(idTenant: string, id: string): Promise<void> {
    await this.cattleRepository.delete(idTenant, id);
  }

  async findByAnyEartag(idTenant: string, eartag: string, manager?: EntityManager): Promise<Cattle | null> {
    return await this.cattleRepository.findByAnyEartag(idTenant, eartag, manager);
  }
  async findByNumber(idTenant: string, number: string, manager?: EntityManager): Promise<Cattle | null> {
    return await this.cattleRepository.findByNumberAndTenantId(idTenant, number, manager);
  }

  list(idTenant: string): Promise<Cattle[]> {
    return this.cattleRepository.findAll(idTenant);
  }

  async search(idTenant: string, query: string): Promise<Cattle[]> {
    if (!query || query.trim().length === 0) return [];
    const statuses = [CattleStatus.ACTIVE];
    return this.cattleRepository.search(idTenant, query, statuses);
  }

  async listPaged(idTenant: string, q: CattleListQueryDto) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.max(1, q.limit ?? 10);
    const { total, rows } = await this.cattleRepository.listPaged(idTenant, q, page, limit);
    // Procesamos todos los rows en paralelo
    const items = await Promise.all(rows.map(async (cattle) => {
      // Ejecutamos las dos consultas de historial en paralelo para este cattle
      const [weightHistory, medicationHistory] = await Promise.all([
        this.cattleWeightHistoryRepository.findByCattle(idTenant, cattle.id),
        this.cattleMedicationHistoryRepository.findByCattle(idTenant, cattle.id),
      ]);
      // Retornamos un objeto nuevo combinando los datos del cattle con los historiales
      return {
        ...cattle,
        weightHistory,
        medicationHistory,
      };
    }));
    return { page, limit, total, items };
  }

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
    this.validateStatusForApplyEvents(cattle.status);
    // Create weight history using repository (no need for full entity)
    const weightHistory = {
      idCattle: cattleId,
      weight: dto.weight,
      date: new Date(dto.measuredDate || new Date()),
      recordedBy: userId,
      idTenant,
      context: WeightContext.MANUAL,
    };

    return this.cattleWeightHistoryRepository.create(weightHistory as any);
  }

  /**
   * Add medication record to history
   * @param idTenant - The tenant ID
   * @param idCattle - The cattle ID
   * @param dto - The medication data
   * @param userId - The user ID who recorded
   * @returns The created history record
   */
  async addMedicationHistory(idTenant: string, idCattle: string, dto: CreateCattleMedicationHistoryDto, userId?: string) {
    const cattle = await this.cattleRepository.findOne(idTenant, idCattle);
    if (!cattle) {
      throw new NotFoundException('Cattle not found');
    }
    this.validateStatusForApplyEvents(cattle.status);
    const medicationHistory = new CattleMedicationHistory();
    medicationHistory.idTenant = idTenant;
    medicationHistory.idCattle = idCattle;
    medicationHistory.medicationName = dto.medicationName;
    medicationHistory.dosage = dto.dosage;
    medicationHistory.route = dto.route;
    medicationHistory.lot = dto.lot;
    medicationHistory.recordedBy = userId;
    medicationHistory.appliedAt = dto.appliedAt ? new Date(dto.appliedAt) : new Date();
    return this.cattleMedicationHistoryRepository.create(medicationHistory);
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
    this.validateStatusForApplyEvents(cattle.status);
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

  validateStatusForApplyEvents(status: string) {
    if (status !== CattleStatus.ACTIVE) {
      throw new BadRequestException('cattleIsNotActive');
    }
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