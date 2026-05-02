import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PurchaseReceptionRepository } from '../repositories/purchase-reception.repository';
import { PurchaseReceptionResponseDto } from '../dto/reception-response.dto';
import { SimpleEventType } from '../../massive-events/enums/simple-event-type.enum';
import { PurchaseReception } from '../entities/purchase-reception.entity';
import { ReceiveCattleRequestDto, UpdateLotCattleRequestDto } from '../dto/receive-cattle-request.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MassiveEventRepository } from 'src/modules/massive-events/repositories/massive-event.repository';
import { EntityManager } from 'typeorm';
import { MassiveEvent } from 'src/modules/massive-events/entities/massive-events.entity';
import { LotRepository } from 'src/modules/commerce/repositories/lot.repository';
import { CattleRepository } from 'src/modules/farm/repositories/cattle.repository';
import { AnimalSimpleEventRepository } from 'src/modules/massive-events/repositories/animal-simple-event.repository';
import { SimpleEventRepository } from 'src/modules/massive-events/repositories/simple-event.repository';
import { AnimalSimpleEvent } from '../../massive-events/entities/animal-simple-event.entity';
import { PurchaseRepository } from 'src/modules/commerce/repositories/purchase.repository';
import { Cattle, CattleStatus } from '../../farm/entities/cattle.entity';
import { ProviderRepository } from '../../commerce/repositories/provider.repository';
import { CattleService } from 'src/modules/farm/services/cattle.service';
import { ConfigurationsService } from 'src/modules/configurations/services/configurations.service';
import { CattleWeightHistory, WeightContext } from '../../farm/entities/cattle-weight-history.entity';
import { CattleWeightHistoryRepository } from '../../farm/repositories/cattle-weight-history.repository';
import { ReceiveCattleResponseDto } from '../dto/receive-cattle-response.dto';
import { CattleCharacteristicRepository } from '../../farm/repositories/cattle-characteristic.repository';
import { ColorCharacteristicsService } from '../../farm/services/color-characteristics.service';
import { LotService } from 'src/modules/commerce/services/lot.service';
import { Lot } from 'src/modules/commerce/entities/lot.entity';
import { Device } from 'src/modules/production-center/entities/device.entity';
import { Repository, ILike } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { DevicesService } from 'src/modules/production-center/services/devices.service';
import { CattleDeviceHistoryRepository } from 'src/modules/farm/repositories/cattle-device-history.repository';


@Injectable()
export class ReceptionsService {
  constructor(
    private readonly ds: DataSource,
    private readonly prRepo: PurchaseReceptionRepository,
    private readonly purchaseRepo: PurchaseRepository,
    private readonly massiveEventRepo: MassiveEventRepository,
    private readonly lotRepo: LotRepository,
    private readonly cattleService: CattleService,
    private readonly cattleRepo: CattleRepository,
    private readonly animalSimpleEventRepo: AnimalSimpleEventRepository,
    private readonly simpleEventRepo: SimpleEventRepository,
    private readonly providerRepo: ProviderRepository,
    private readonly configurationsService: ConfigurationsService,
    private readonly cattleWeightHistoryRepo: CattleWeightHistoryRepository,
    private readonly cattleCharacteristicRepository: CattleCharacteristicRepository,
    private readonly cattleDeviceHistoryRepository: CattleDeviceHistoryRepository,
    private readonly deviceService: DevicesService,
    private readonly colorCharacteristicsService: ColorCharacteristicsService,
    private readonly lotService: LotService,

    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) { }

  async searchDevices(idTenant: string, query: string): Promise<Device[]> {
    return this.deviceRepo.find({
      take: 20,
      where: [
        { idTenant, name: ILike(`%${query}%`) },
        { idTenant, deveui: ILike(`%${query}%`) }
      ]
    });
  }

  async getSimpleReception(idTenant: string, idPurchase: string, manager: EntityManager): Promise<PurchaseReception | null> {
    return await this.prRepo.findByPurchase(idTenant, idPurchase, manager);
  }

  async findOrCreateReceptionByIdPurchase(idTenant: string, idPurchase: string, userId: string): Promise<PurchaseReceptionResponseDto> {
    var reception = this.ds.transaction(async (manager) => {
      var purchase = await this.purchaseRepo.findById(idPurchase, idTenant, manager);
      if (!purchase) {
        throw new NotFoundException('Purchase not found');
      }
      var reception = await this.prRepo.findByPurchase(idTenant, idPurchase, manager);
      var massiveEvent;
      if (!reception) {
        var dataMassiveEvent: MassiveEvent = {
          id: uuidv4(),
          idTenant,
          eventDate: new Date(),
          status: 'open',
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          simpleEvents: [],
          name: 'Reception ' + purchase!.id,
        }
        massiveEvent = await this.massiveEventRepo.saveWithManager(manager, dataMassiveEvent);
        massiveEvent.simpleEvents = [];
        reception = await this.prRepo.createInstance({ idTenant, idPurchase, idMassiveEvent: massiveEvent.id }, manager);
      } else {
        massiveEvent = await this.massiveEventRepo.findById(idTenant, reception.idMassiveEvent, manager);
        if (massiveEvent) {
          massiveEvent.simpleEvents = await this.simpleEventRepo.findByMassiveEvent(idTenant, massiveEvent.id, manager);
        }
      }
      var provider = await this.providerRepo.findById(purchase!.idProvider, idTenant, manager);
      if (!provider) {
        throw new NotFoundException('Provider not found');
      }
      var lots = await this.lotRepo.findByPurchaseId(idPurchase, idTenant, manager);
      var lotCattle: Record<string, Cattle[]> = {};
      var appliedEvents: Record<string, AnimalSimpleEvent[]> = {};
      for (const l of lots) {
        var lc = await this.cattleRepo.findByIdLot(idTenant, l.id, manager);
        for (const c of lc) {
          var animalSimpleEvents = await this.animalSimpleEventRepo.findByCattle(idTenant, c.id, manager);
          appliedEvents[c.id] = animalSimpleEvents;
        }
        lotCattle[l.id] = lc;
      }
      var cattle = await this.cattleRepo.findByIdPurchaseWithoutLot(idTenant, idPurchase, manager);
      for (const c of cattle) {
        var animalSimpleEvents = await this.animalSimpleEventRepo.findByCattle(idTenant, c.id, manager);
        appliedEvents[c.id] = animalSimpleEvents;
      }
      return PurchaseReceptionResponseDto.toResponseDto(reception, purchase!, provider.name, lots, lotCattle, cattle, appliedEvents, massiveEvent);
    });
    return reception;
  }



  async receiveCattle_Transaction(idTenant: string, idCurrentUser: string, cattleDto: ReceiveCattleRequestDto): Promise<ReceiveCattleResponseDto> {
    return this.ds.transaction(async manager => {
      let cattle = await this.cattleRepo.findByNumberAndTenantId(idTenant, cattleDto.number, manager);
      if (cattle && (cattle.status === CattleStatus.ACTIVE || cattle.status === CattleStatus.LOST)) {
        throw new ConflictException('Cattle with number ' + cattleDto.number + ' already exists');
      }
      var nextCattleSysnumber = await this.configurationsService.getTenantConfiguration(idTenant, 'next_cattle_sysnumber', manager);
      if (!nextCattleSysnumber) {
        throw new NotFoundException('Configuration next_cattle_sysnumber not found');
      }
      var nextCattleSysnumberValue = parseInt(nextCattleSysnumber.value);
      await this.configurationsService.updateTenantConfiguration(idTenant, 'next_cattle_sysnumber', (nextCattleSysnumberValue + 1).toString(), manager);
      if (cattleDto.eartagLeft) {
        const existingCattleWithEartag = await this.cattleRepo.findByAnyEartag(idTenant, cattleDto.eartagLeft, manager);
        if (existingCattleWithEartag) {
          throw new ConflictException(`Eartag ${cattleDto.eartagLeft} already exists for another cattle`);
        }
      }
      if (cattleDto.eartagRight) {
        const existingCattleWithEartag = await this.cattleRepo.findByAnyEartag(idTenant, cattleDto.eartagRight, manager);
        if (existingCattleWithEartag) {
          throw new ConflictException(`Eartag ${cattleDto.eartagRight} already exists for another cattle`);
        }
      }
      if (cattleDto.idDevice) {
        await this.cattleDeviceHistoryRepository.unassignDeviceByidDevice(idTenant, cattleDto.idDevice, manager, new Date());
        await this.cattleRepo.unsetDevice(idTenant, cattleDto.idDevice, manager);
      }
      if (cattleDto.idLot) {
        let lot = await this.lotRepo.findById(idTenant, cattleDto.idLot, manager);
        if (!lot) {
          throw new NotFoundException('Lot not found ' + cattleDto.idLot);
        }
        if (!cattleDto.purchaseWeight) {
          cattleDto.purchaseWeight = lot.averageWeight;
        }
        if (!cattleDto.purchasePrice) {
          cattleDto.purchasePrice = lot.averageWeight * lot.pricePerKg;
        }
      }
      var cattleData = {
        id: uuidv4(),
        idTenant,
        sysNumber: nextCattleSysnumberValue,
        number: cattleDto.number,
        receivedAt: new Date(),
        receivedWeight: cattleDto.receivedWeight,
        purchaseWeight: cattleDto.purchaseWeight,
        purchasePrice: cattleDto.purchasePrice,
        idLot: cattleDto.idLot ?? null,
        idBrand: cattleDto.idBrand ?? null,
        color: cattleDto.color,
        eartagLeft: cattleDto.eartagLeft ?? null,
        eartagRight: cattleDto.eartagRight ?? null,
        idDevice: cattleDto.idDevice ?? null,
        castrated: cattleDto.castrated,
        comments: cattleDto.comments ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastWeight: cattleDto.receivedWeight,
        status: CattleStatus.ACTIVE,
        idProvider: cattleDto.idProvider ?? null,
        idPurchase: cattleDto.idPurchase,
        gender: cattleDto.gender,
        birthDateAprx: cattleDto.birthDateAprx ? new Date(cattleDto.birthDateAprx) : null,
        hasHorn: cattleDto.hasHorn
      }

      cattle = await this.cattleRepo.saveWithManager(manager, cattleData as unknown as Cattle);
      var weightHistory: CattleWeightHistory = {
        id: uuidv4(),
        idTenant,
        idCattle: cattle.id,
        weight: cattleDto.receivedWeight,
        date: new Date(),
        context: WeightContext.RECEIVED,
        recordedBy: idCurrentUser,
      }
      await this.cattleWeightHistoryRepo.createWithManager(manager, weightHistory);
      var characteristics = cattleDto.characteristics ?? [];
      if (characteristics.length > 0) {
        await this.cattleCharacteristicRepository.attachMany(cattle.id, idTenant, characteristics, manager);
      }
      if (cattleDto.idLot) {
        await this.lotService.UpdateLotDataAfterReception(idTenant, cattleDto.idLot, manager);
      }
      var reception: PurchaseReception | null = null;
      if (cattleDto.idPurchase) {
        reception = await this.getSimpleReception(idTenant, cattleDto.idPurchase, manager);
        if (reception != null) {
          var nextnumber = await this.cattleRepo.getSuggestNextNumber(idTenant, cattleDto.number, manager);
          reception.nextCattleNumber = nextnumber;
          await manager.save(reception);
        }
      }
      if (cattleDto.idDevice) {
        const device = await this.deviceService.findById(cattleDto.idDevice, idTenant, manager);
        if (device) {
          const tags = device.tags ?? {};
          tags.idCattle = cattle.id;
          tags.idDevice = device.id;
          tags.idTenant = idTenant;
          const deviceUpdateDto = {
            tags: tags
          };
          await this.deviceService.updateWithDevice(device, deviceUpdateDto, manager);
          await this.cattleDeviceHistoryRepository.assignDeviceToCattle(
            device.id,
            cattle.id,
            idTenant,
            idCurrentUser,
            new Date(),
            undefined,
            manager,
          );
          cattle.device = device;
        } else {
          throw new NotFoundException(`Device ${cattleDto.idDevice} not found`);
        }
      }
      var simpleEventIds = cattleDto.idSimpleEvents ?? [];
      var appliedEvents: Array<{
        type: SimpleEventType;
        data: any;
        appliedBy?: string;
        appliedAt?: Date;
        idSimpleEvent: string;
      }> = [];
      if (simpleEventIds.length > 0) {
        var simpleEvents = await this.simpleEventRepo.findByIds(idTenant, simpleEventIds, manager);
        if (simpleEvents && simpleEvents.length > 0) {
          var simpEvents: Array<{
            type: SimpleEventType;
            data: any;
            appliedBy?: string;
            appliedAt?: Date;
            idSimpleEvent: string;
          }> = [];
          var idMassiveEvent: string | undefined;
          for (const simpleEvent of simpleEvents) {
            idMassiveEvent = simpleEvent.idMassiveEvent;
            if (simpleEvent.type !== SimpleEventType.WEIGHT) {
              simpEvents.push({
                type: simpleEvent.type,
                data: simpleEvent.data,
                appliedBy: idCurrentUser,
                appliedAt: new Date(),
                idSimpleEvent: simpleEvent.id,
              })
            }
          }
          appliedEvents = await this.cattleService.applyMultipleSimpleEventsByNumber_manager(idTenant, idCurrentUser, cattle.number, idMassiveEvent!, simpEvents, manager, cattle)
        }
      }
      return ReceiveCattleResponseDto.toResponseDto(cattle, appliedEvents);
    });
  }

  /** 
   * Update the lot of a cattle
   * @param idTenant 
   * @param dto 
   * @returns Cattle
   */
  async assignLotCattle(idTenant: string, dto: UpdateLotCattleRequestDto): Promise<Cattle> {
    return this.ds.transaction(async manager => {
      let cattle = await this.cattleRepo.findById(idTenant, dto.idCattle, manager);
      if (!cattle) {
        throw new NotFoundException('Cattle not found');
      }
      var oldLot: Lot | null = null;
      if (cattle.idLot) {
        oldLot = await this.lotRepo.findById(idTenant, cattle.idLot, manager);
      }
      let lot = await this.lotRepo.findById(idTenant, dto.idLot, manager);
      if (!lot) {
        throw new NotFoundException('Lot not found');
      }
      cattle.idLot = dto.idLot;
      cattle.purchaseWeight = lot.averageWeight ?? 0;
      cattle.purchasePrice = (lot.averageWeight ?? 0) * (lot.pricePerKg ?? 0);
      cattle = await this.cattleRepo.saveWithManager(manager, cattle);
      await this.lotService.UpdateLotDataAfterReception(idTenant, dto.idLot, manager);
      if (oldLot) {
        await this.lotService.UpdateLotDataAfterReception(idTenant, oldLot.id, manager);
      }
      return cattle;
    });
  }

  async nextNumber(idTenant: string, number: string): Promise<string> {
    return this.ds.transaction(async manager => {
      return await this.cattleRepo.getSuggestNextNumber(idTenant, number, manager);
    });
  }
}