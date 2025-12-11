import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PurchaseReceptionRepository } from '../repositories/purchase-reception.repository';
import { PurchaseReceptionResponseDto } from '../dto/reception-response.dto';
import { SimpleEventType } from '../../massive-events/enums/simple-event-type.enum';
import { PurchaseReception } from '../entities/purchase-reception.entity';
import { ReceiveCattleRequestDto } from '../dto/receive-cattle-request.dto';
import { NotFoundException } from '@nestjs/common';
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
import { CattleCharacteristic } from 'src/modules/farm/entities/cattle-characteristic.entity';
import { Characteristic } from 'src/modules/farm/entities/characteristic.entity';
import { Color } from 'src/modules/farm/entities/color.entity';
import { ColorRepository } from 'src/modules/farm/repositories/color.repository';
import { CharacteristicRepository } from 'src/modules/farm/repositories/characteristic.repository';

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
    private readonly colorRepo: ColorRepository,
    private readonly characteristicRepo: CharacteristicRepository,
  ) { }

  async findOrCreateReceptionByIdPurchase(idTenant: string, idPurchase: string, userId: string): Promise<PurchaseReceptionResponseDto> {
    var reception = this.ds.transaction(async (manager) => {
      console.log('idTenant', idTenant);
      console.log('idPurchase', idPurchase);
      console.log('userId', userId);
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

      return PurchaseReceptionResponseDto.toResponseDto(reception, purchase!, provider!.name, lots, lotCattle, cattle, appliedEvents, massiveEvent);
    });
    return reception;
  }

  async getColors(idTenant: string): Promise<Color[]> {
    return this.colorRepo.listActive(idTenant);
  }

  async getCharacteristics(idTenant: string): Promise<Characteristic[]> {
    return this.characteristicRepo.listActive(idTenant);
  }


  async receiveCattle_Transaction(idTenant: string, idCurrentUser: string, cattleDto: ReceiveCattleRequestDto): Promise<ReceiveCattleResponseDto> {
    return this.ds.transaction(async manager => {
      let cattle = await this.cattleRepo.findByNumberAndTenantId(idTenant, cattleDto.number, manager);
      if (cattle && (cattle.status === CattleStatus.ACTIVE || cattle.status === CattleStatus.LOST)) {
        throw new NotFoundException('Cattle already exists');
      }
      var nextCattleSysnumber = await this.configurationsService.getTenantConfiguration(idTenant, 'next_cattle_sysnumber', manager);
      var nextCattleSysnumberValue = parseInt(nextCattleSysnumber!.value);
      await this.configurationsService.updateTenantConfiguration(idTenant, 'next_cattle_sysnumber', (nextCattleSysnumberValue + 1).toString(), manager);
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
        idColor: cattleDto.idColor ?? null,
        eartag: cattleDto.eartag ?? null,
        idDevice: cattleDto.idDevice ?? null,
        castrated: cattleDto.castrated,
        comments: cattleDto.comments ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastWeight: cattleDto.receivedWeight,
        status: CattleStatus.ACTIVE,
        idProvider: cattleDto.idProvider ?? null,
        idPurchase: cattleDto.idPurchase,
      }
      cattle = await this.cattleRepo.saveWithManager(manager, cattleData as unknown as Cattle);
      var weightHistory: CattleWeightHistory = {
        id: uuidv4(),
        idTenant,
        idCattle: cattle.id,
        weight: cattleDto.receivedWeight,
        date: new Date(),
        context: WeightContext.PURCHASE,
        recordedBy: idCurrentUser,
      }
      await this.cattleWeightHistoryRepo.createWithManager(manager, weightHistory);
      var characteristicsIds = cattleDto.characteristicsIds ?? [];
      if (characteristicsIds.length > 0) {
        await this.cattleCharacteristicRepository.attachMany(cattle.id, idTenant, characteristicsIds, manager);
      }
      const simpleEventIds = cattleDto.idSimpleEvents ?? [];
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
}