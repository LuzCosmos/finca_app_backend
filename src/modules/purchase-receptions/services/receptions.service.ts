import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PurchaseReceptionRepository } from '../repositories/purchase-reception.repository';
import { ReceptionResponseDto, CattleReceptionResponseDto, LotReceptionResponseDto, AnimalSimpleEventReceptionResponseDto } from '../dto/reception-response.dto';
import { PurchaseReception } from '../entities/purchase-reception.entity';
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
import { Cattle } from '../../farm/entities/cattle.entity';
import { ProviderRepository } from '../../commerce/repositories/provider.repository';


@Injectable()
export class ReceptionsService {
  constructor(
    private readonly ds: DataSource,
    private readonly prRepo: PurchaseReceptionRepository,
    private readonly purchaseRepo: PurchaseRepository,
    private readonly massiveEventRepo: MassiveEventRepository,
    private readonly lotRepo: LotRepository,
    private readonly cattleRepo: CattleRepository,
    private readonly animalSimpleEventRepo: AnimalSimpleEventRepository,
    private readonly simpleEventRepo: SimpleEventRepository,
    private readonly providerRepo: ProviderRepository
  ) { }

  async createReception(idTenant: string, idPurchase: string, manager: EntityManager) {
    const reception = await this.prRepo.createInstance({ idTenant, idPurchase }, manager);
    return reception;
  }

  async findOrCreateReceptionByIdPurchase(idTenant: string, idPurchase: string, userId: string): Promise<ReceptionResponseDto> {
    var reception = this.ds.transaction(async (manager) => {
      console.log('idTenant', idTenant);
      console.log('idPurchase', idPurchase);
      console.log('userId', userId);
      var purchase = await this.purchaseRepo.findById(idPurchase, idTenant, manager);
      if (!purchase) {
        throw new NotFoundException('Purchase not found');
      }
      var reception = await this.prRepo.findByPurchase(idTenant, idPurchase, manager);
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
        }
        var massiveEvent = await this.massiveEventRepo.saveWithManager(manager, dataMassiveEvent);
        massiveEvent.simpleEvents = await this.simpleEventRepo.findByMassiveEvent(idTenant, massiveEvent.id, manager);
        reception = await this.prRepo.createInstance({ idTenant, idPurchase, idMassiveEvent: massiveEvent.id }, manager);
      }
      var provider = await this.providerRepo.findById(purchase!.idProvider, idTenant, manager);
      var lots = await this.lotRepo.findByPurchaseId(idPurchase, idTenant, manager);
      var lotCattle: Record<string, Cattle[]> = {};
      var appliedEvents: Record<string, AnimalSimpleEvent[]> = {};
      for (const l of lots) {
        var lc = await this.cattleRepo.findByIdLot(idTenant, l.id, manager);
        for (const c of lc) {
          var animalSimpleEvents = await this.animalSimpleEventRepo.findByCattle(c.id, idTenant, manager);
          appliedEvents[c.id] = animalSimpleEvents;
        }
        lotCattle[l.id] = lc;
      }
      var cattle = await this.cattleRepo.findByIdPurchaseWithoutLot(idTenant, idPurchase, manager);
      for (const c of cattle) {
        var animalSimpleEvents = await this.animalSimpleEventRepo.findByCattle(c.id, idTenant, manager);
        appliedEvents[c.id] = animalSimpleEvents;
      }
      console.log(provider)
      return ReceptionResponseDto.toResponseDto(reception, purchase!, provider!.name, lots, lotCattle, cattle, appliedEvents);
    });
    return reception;
  }

}