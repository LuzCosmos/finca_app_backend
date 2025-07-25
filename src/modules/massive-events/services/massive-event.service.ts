import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MassiveEventRepository } from '../repositories/massive-event.repository';
import { SimpleEventRepository } from '../repositories/simple-event.repository';
import { CreateMassiveEventDto } from '../dto/create-massive-event.dto';
import { SimpleEventCattleRepository } from '../repositories/simple-event-cattle.repository';
import { CattleRepository } from 'src/modules/farm/repositories/cattle.repository';
import { SimpleEvent } from '../entities/simple-event.entity';
import { MassiveEvent } from '../entities/massive-events.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MassiveEventService {
  private readonly logger = new Logger(MassiveEventService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly massiveEventRepo: MassiveEventRepository,
    private readonly simpleEventRepo: SimpleEventRepository,
    private readonly simpleEventCattleRepository: SimpleEventCattleRepository,
    private readonly cattleRepository: CattleRepository,
  ) {}

  /**
   * Create a MassiveEvent with initial simpleEvents (can be empty in the future)
   * @param idTenant - The tenant ID
   * @param createdBy - The user who created the MassiveEvent
   * @param dto - The data transfer object containing the event date and simple events
   * @returns The created MassiveEvent with its ID, event date, status, and associated simple events
   */
  async createMassiveEvent(
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
  async findOne(idTenant: string, idMassiveEvent: string): Promise<MassiveEvent> {
    const massiveEvent = await this.massiveEventRepo.findOneWithSimpleEvents(idTenant, idMassiveEvent);
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
    const cattleIds = links.map(link => link.idCattle).filter(Boolean) as string[];
    const cattleList = await this.cattleRepository.findByIds(idTenant, cattleIds);
  
    // 4. Combinar info si quieres
    return cattleList.map(cattle => {
      return {
        id: cattle.id,
        number: cattle.number,
        idBrand: cattle.idBrand,
        lastWeight: cattle.lastWeight,
        // …otros campos de cattle
        appliedAt: links.find(l => l.idCattle === cattle.id)?.appliedAt,
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
    const event = await this.massiveEventRepo.findById(id, idTenant);
    if (!event) throw new NotFoundException('MassiveEvent not found');
    event.status = 'closed';
    return this.massiveEventRepo.save(event);
  }

  /**
   * Delete a MassiveEvent by ID and tenant
   * @param idTenant - The tenant ID
   * @param id - The MassiveEvent ID
   * @returns The deleted MassiveEvent
   */
  async deleteMassiveEvent(idTenant: string, id: string): Promise<void> {
    const event = await this.massiveEventRepo.findById(id, idTenant);
    if (!event) throw new NotFoundException('MassiveEvent not found');
    await this.dataSource.transaction(async manager => {
      await this.simpleEventRepo.deleteByMassiveEvent(manager, id);
      await this.massiveEventRepo.deleteByIdWithManager(manager, id, idTenant);
    });
  }
  
}
