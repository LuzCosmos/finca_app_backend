import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SimpleEventRepository } from '../repositories/simple-event.repository';
import { CreateSimpleEventDto, ValidateDataFields } from '../dto/create-simple-event.dto';
import { DataSource, EntityManager } from 'typeorm';
import { SimpleEvent } from '../entities/simple-event.entity';
import { SyncSimpleEventDto } from '../dto/sync-simple-events.dto';
import { SyncSimpleEventResultDto } from '../dto/sync-simple-events.dto';
import { SimpleEventType } from '../enums/simple-event-type.enum';
import { v4 as uuidv4 } from 'uuid';
import { MassiveEventService } from './massive-event.service';
import { MassiveEvent } from '../entities/massive-events.entity';

@Injectable()
export class SimpleEventService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly simpleEventRepo: SimpleEventRepository,
    private readonly massiveEventSevice: MassiveEventService,
  ) { }

  /**
   * Create a SimpleEvent
   * @param idTenant - The tenant ID
   * @param dto - The data transfer object containing the event date and simple events
   * @returns The created SimpleEvent
   */
  async createSimpleEvent12(
    idTenant: string,
    dto: CreateSimpleEventDto,
  ) {
    await this.massiveEventSevice.findByIdOrFail(idTenant, dto.idMassiveEvent);
    const typesWithData = ['brand', 'medication'];
    if (typesWithData.includes(dto.type)) {
      if (!dto.data) {
        throw new BadRequestException(`Data is required for type ${dto.type}`);
      }
    } else {
      if (dto.data) {
        throw new BadRequestException(`Data is not allowed for type ${dto.type}`);
      }
    }
    const simpleEvent = this.simpleEventRepo.createInstance({
      idMassiveEvent: dto.idMassiveEvent,
      type: dto.type,
      data: dto.data ?? null,
    });
    return this.simpleEventRepo.save(simpleEvent);
  }


  /**
   * Save a SimpleEvent
   * @param manager - The entity manager
   * @param payload - The payload containing the SimpleEvent data
   * @returns The saved SimpleEvent
   */
  private async saveSimpleEvent(
    manager: EntityManager,
    payload: { id: string; idMassiveEvent: string; idTenant: string; type: SimpleEventType; dataJson?: string; createdAt?: string }
  ): Promise<SimpleEvent> {
    const exists = await manager.findOne(SimpleEvent, { where: { id: payload.id } });
    if (exists) return exists;
    if (payload.idMassiveEvent == null || payload.idMassiveEvent.trim() === '') {
      throw new BadRequestException('idMassiveEvent is required');
    }
    this.validateDataFields(payload.type, payload.dataJson);
    const simpleEvent = this.simpleEventRepo.createInstance({
      id: payload.id,
      idMassiveEvent: payload.idMassiveEvent,
      idTenant: payload.idTenant,
      type: payload.type,
      data: payload.dataJson ? JSON.parse(payload.dataJson) : null,
      createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
    });
    return this.simpleEventRepo.saveWithManager(manager, simpleEvent);
  }

  /**
   * Create a SimpleEvent
   * @param idTenant - The tenant ID
   * @param dto - The data transfer object containing the event date and simple events
   * @returns The created SimpleEvent
   */
  async createSimpleEvent(idTenant: string, dto: CreateSimpleEventDto) {
    await this.massiveEventSevice.findByIdOrFail(idTenant, dto.idMassiveEvent);

    return this.dataSource.transaction(manager =>
      this.saveSimpleEvent(manager, {
        id: uuidv4(),
        idMassiveEvent: dto.idMassiveEvent,
        idTenant,
        type: dto.type,
        dataJson: dto.data ? JSON.stringify(dto.data) : undefined,
      }),
    );
  }

  /**
   * Sync SimpleEvents
   * @param idTenant - The tenant ID
   * @param dtos - The data transfer object containing the event date and simple events
   * @returns The synced SimpleEvents
   */
  async syncSimpleEvents(idTenant: string, dtos: SyncSimpleEventDto[]): Promise<SyncSimpleEventResultDto[]> {
    return this.dataSource.transaction(async manager => {
      const results: SyncSimpleEventResultDto[] = [];
      for (const dto of dtos) {
        let massiveEvent: MassiveEvent;
        try {
          massiveEvent = await this.massiveEventSevice.findByIdOrFail(idTenant, dto.massiveEventServerId);
        } catch (error) {
          results.push({ id: dto.id, status: 'failed', serverId: '', message: 'MassiveEvent not found' });
          continue;
        }
        const saved = await this.saveSimpleEvent(manager, {
          id: dto.id,
          idMassiveEvent: massiveEvent.id,
          idTenant,
          type: dto.type,
          dataJson: dto.dataJson,
          createdAt: dto.createdAt,
        });
        results.push({ id: saved.id, status: 'synced', serverId: saved.id });
      }
      return results;
    });
  }

  /**
   * Get a SimpleEvent by ID
   * @param idTenant - The tenant ID
   * @param id - The SimpleEvent ID
   * @returns The SimpleEvent
   */
  async findByIdOrFail(idTenant: string, id: string, manager?: EntityManager) {
    const simpleEvent = this.simpleEventRepo.findById(idTenant, id, manager);
    if (!simpleEvent) throw new NotFoundException(`SimpleEvent ${id} not found`);
    return simpleEvent;
  }

  /**
   * Get all SimpleEvents by MassiveEvent ID
   * @param idMassiveEvent - The MassiveEvent ID
   * @returns The SimpleEvents
   */
  async findByMassiveEvent(idTenant: string, idMassiveEvent: string) {
    return this.simpleEventRepo.findByMassiveEvent(idTenant, idMassiveEvent);
  }

  /**
   * Delete a SimpleEvent by ID
   * @param id - The SimpleEvent ID
   * @returns The deleted SimpleEvent
   */
  async delete(id: string) {
    return this.simpleEventRepo.deleteById(id);
  }

  /**
   * Delete all SimpleEvents by MassiveEvent ID
   * @param idMassiveEvent - The MassiveEvent ID
   * @returns The deleted SimpleEvents
   */
  async deleteByMassiveEvent(manager: EntityManager, idMassiveEvent: string) {
    return this.simpleEventRepo.deleteByMassiveEvent(manager, idMassiveEvent);
  }

  validateDataFields(type: string, dataJson: any) {
    if (type == 'medication') {
      if (dataJson == null || dataJson.trim() === '') {
        throw new BadRequestException('dataJson is required for type medication');
      } else {
        var data = JSON.parse(dataJson);
        const requiredKeys = ['medicationName', 'dosage', 'lot'];
        // Check keys presence
        const dataKeys = Object.keys(data);
        const hasAllKeys = requiredKeys.every((k) => dataKeys.includes(k));
        if (!hasAllKeys) {
          throw new BadRequestException('dataJson is invalid for type medication');
        }
        // Check non-empty string values
        var isValid = requiredKeys.every(
          (key) =>
            typeof data[key] === 'string' && data[key].trim().length > 0
        );
        if (!isValid) {
          throw new BadRequestException('dataJson is invalid for type medication');
        }
      }
    }
  }

  findByIds(idTenant: string, ids: string[], manager?: EntityManager) {
    return this.simpleEventRepo.findByIds(idTenant, ids, manager);
  }
}
