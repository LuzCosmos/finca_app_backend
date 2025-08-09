import { Injectable, NotFoundException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { MassiveEventRepository } from '../repositories/massive-event.repository';
import { SimpleEventRepository } from '../repositories/simple-event.repository';
import { CreateMassiveEventDto } from '../dto/create-massive-event.dto';
import { AnimalSimpleEventRepository } from '../repositories/animal-simple-event.repository';
import { CattleRepository } from 'src/modules/farm/repositories/cattle.repository';
import { SimpleEvent } from '../entities/simple-event.entity';
import { MassiveEvent } from '../entities/massive-events.entity';
import { v4 as uuidv4 } from 'uuid';
import { SyncMassiveEventDto, SyncMassiveEventResultDto } from '../dto/sync-massive-event.dto';

@Injectable()
export class MassiveEventService {
  private readonly logger = new Logger(MassiveEventService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly massiveEventRepo: MassiveEventRepository,
    private readonly simpleEventRepo: SimpleEventRepository,
    private readonly simpleEventCattleRepository: AnimalSimpleEventRepository,
    private readonly cattleRepository: CattleRepository,
  ) {}

  private async saveMassiveAndSimples(manager: EntityManager, payload: SyncMassiveEventDto): Promise<MassiveEvent> {
    let massiveEvent = await manager.findOne(MassiveEvent, {
      where: { id: payload.id, idTenant: payload.idTenant },
    });

    if (!massiveEvent) {
      massiveEvent = this.massiveEventRepo.createInstance({
        id: payload.id,
        idTenant: payload.idTenant,
        eventDate: new Date(payload.eventDate),
        status: payload.status,
        createdBy: payload.createdBy,
        createdAt: payload.createdAt ? new Date(payload.createdAt) : undefined,
        updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : undefined,
      });
      await this.massiveEventRepo.saveWithManager(manager, massiveEvent);
    }
    var simpleEvents: SimpleEvent[]  = []; 
    if (payload.simpleEvents?.length) {
      
      for (const se of payload.simpleEvents) {
        const exists = await manager.findOne(SimpleEvent, { where: { id: se.id } });
        if (!exists) {
          const simpleEvent = this.simpleEventRepo.createInstance({
            id: se.id,
            idMassiveEvent: massiveEvent.id,
            idTenant: payload.idTenant,
            type: se.type,
            data: se.dataJson ? JSON.parse(se.dataJson) : null,
            createdAt: se.createdAt ? new Date(se.createdAt) : undefined,
          });
          const simEv = await this.simpleEventRepo.saveWithManager(manager, simpleEvent);
          simpleEvents.push(simEv);
        } else {
          simpleEvents.push(exists);
        }
      }
    }
    massiveEvent.simpleEvents = simpleEvents;
    return massiveEvent;
  }

  async createMassiveEvent(idTenant: string, createdBy: string, dto: CreateMassiveEventDto): Promise<MassiveEvent> {
    return this.dataSource.transaction(async manager => {
      const payload: SyncMassiveEventDto = {
        id: uuidv4(),
        idTenant,
        eventDate: dto.eventDate,
        status: 'open',
        createdBy,
        simpleEvents: dto.simpleEvents?.map(se => ({
          id: uuidv4(),
          type: se.type,
          dataJson: se.data ? JSON.stringify(se.data) : undefined,
        })),
      };
      const massiveEvent = await this.saveMassiveAndSimples(manager, payload);
      return massiveEvent;
    });
  }

  /**
   * Sincronizar massiveEvents y sus simpleEvents (offline -> backend)
   */
  async syncMassiveEvents(idTenant: string, dtos: SyncMassiveEventDto[]): Promise<SyncMassiveEventResultDto[]> {
    return this.dataSource.transaction(async manager => {
      const results: SyncMassiveEventResultDto[] = [];
      for (const dto of dtos) {
        const saved = await this.saveMassiveAndSimples(manager, { ...dto, idTenant });
        results.push({ id: saved.id, status: 'synced' });
      }
      return results;
    });
  }

  /**
   * Create a MassiveEvent with initial simpleEvents (can be empty in the future)
   * @param idTenant - The tenant ID
   * @param createdBy - The user who created the MassiveEvent
   * @param dto - The data transfer object containing the event date and simple events
   * @returns The created MassiveEvent with its ID, event date, status, and associated simple events
   */
  async createMassiveEvent1(
    idTenant: string,
    createdBy: string,
    dto: CreateMassiveEventDto,
  ) {
    return this.dataSource.transaction(async manager => {
      const massiveEvent = this.massiveEventRepo.createInstance({
        id: uuidv4(),
        idTenant,
        eventDate: new Date(dto.eventDate),
        status: 'open',
        createdBy,
      });
      await this.massiveEventRepo.saveWithManager(manager, massiveEvent);

      const createdSimpleEvents: SimpleEvent[] = [];
      if (dto.simpleEvents && dto.simpleEvents.length > 0) {
        for (const se of dto.simpleEvents) {
          const simpleEvent = this.simpleEventRepo.createInstance({
            idMassiveEvent: massiveEvent.id,
            type: se.type,
            data: se.data ?? null,
          });
          createdSimpleEvents.push(
            await this.simpleEventRepo.saveWithManager(manager, simpleEvent),
          );
        }
      }
      massiveEvent.simpleEvents = createdSimpleEvents;
      return massiveEvent;
    });
  }

  /**
   * Get a MassiveEvent by ID and tenant
   * @param idTenant - The tenant ID
   * @param id - The MassiveEvent ID
   * @returns The MassiveEvent
   */
  async findByIdOrFail(idTenant: string, idMassiveEvent: string, manager?: EntityManager): Promise<MassiveEvent> {
    const massiveEvent = await this.massiveEventRepo.findById(idTenant, idMassiveEvent, manager);
    if (!massiveEvent) throw new NotFoundException(`MassiveEvent ${idMassiveEvent} not found`);
    return massiveEvent;
  }

  /**
   * Get a MassiveEvent by ID and tenant
   * @param idTenant - The tenant ID
   * @param id - The MassiveEvent ID
   * @returns The MassiveEvent
   */
  async findWithSimpleEventsByIdOrFail(idTenant: string, idMassiveEvent: string, manager?: EntityManager): Promise<MassiveEvent> {
    const massiveEvent = await this.massiveEventRepo.findOneWithSimpleEvents(idTenant, idMassiveEvent, manager);
    if (!massiveEvent) throw new NotFoundException(`MassiveEvent ${idMassiveEvent} not found`);
    return massiveEvent;
  }
  

  async findCattleByMassiveEvent(idTenant: string, idMassiveEvent: string) {
    // 1. Obtener todos los simple events asociados al massive event
    const simpleEvents = await this.simpleEventRepo.findByMassiveEvent(idTenant, idMassiveEvent);
    const simpleEventIds = simpleEvents.map(ev => ev.id);
  
    if (simpleEventIds.length === 0) {
      return []; // No hay eventos, no hay cattle
    }
  
    // 2. Buscar relaciones en simple_event_cattle
    const links = await this.simpleEventCattleRepository.findBySimpleEvents(idTenant, simpleEventIds);
  
    // 3. Opcional: traer más datos de cattle
    const cattleIds = links.map(link => link.idAnimal).filter(Boolean) as string[];
    const cattleList = await this.cattleRepository.findByIds(idTenant, cattleIds);
  
    // 4. Combinar info si quieres
    return cattleList.map(cattle => {
      return {
        id: cattle.id,
        number: cattle.number,
        idBrand: cattle.idBrand,
        lastWeight: cattle.lastWeight,
        // …otros campos de cattle
        appliedAt: links.find(l => l.idAnimal === cattle.id)?.appliedAt,
      };
    });
  }

  /**
   * Get all MassiveEvents by tenant
   * @param idTenant - The tenant ID
   * @returns The MassiveEvents
   */
  async findAll(idTenant: string) {
    return this.massiveEventRepo.findAllByTenant(idTenant);
  }

  /**
   * Close a MassiveEvent
   * @param idTenant - The tenant ID
   * @param id - The MassiveEvent ID
   * @returns The MassiveEvent
   */
  async closeMassiveEvent(idTenant: string, id: string) {
    await this.dataSource.transaction(async manager => {
      const massiveEvent = await this.findByIdOrFail(idTenant, id, manager);
      //if (massiveEvent.status === 'closed') throw new HttpException('Massive event already closed', HttpStatus.UNPROCESSABLE_ENTITY); //422
      await this.simpleEventRepo.deleteUnappliedByMassiveEvent(manager, idTenant, id);
      const simpleEvents = await this.simpleEventRepo.findByMassiveEvent(idTenant, id);
      if (simpleEvents.length === 0) {
        throw new HttpException('No simple events applied', HttpStatus.UNPROCESSABLE_ENTITY); //422
      }
      await this.massiveEventRepo.updateByIdWithManager(manager, id, idTenant, { status: 'closed' });
    });
  }

  /**
   * Delete a MassiveEvent by ID and tenant
   * @param idTenant - The tenant ID
   * @param id - The MassiveEvent ID
   * @returns The deleted MassiveEvent
   */
  async deleteMassiveEvent(idTenant: string, id: string): Promise<void> {
    await this.dataSource.transaction(async manager => {
      const event = await this.findByIdOrFail(idTenant, id, manager);
      await this.simpleEventRepo.deleteByMassiveEvent(manager, id);
      await this.massiveEventRepo.deleteByIdWithManager(manager, id, idTenant);
    });
  }
  
}
