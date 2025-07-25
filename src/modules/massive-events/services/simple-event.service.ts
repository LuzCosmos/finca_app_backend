import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SimpleEventRepository } from '../repositories/simple-event.repository';
import { MassiveEventRepository } from '../repositories/massive-event.repository';
import { CreateSimpleEventDto } from '../dto/create-simple-event.dto';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class SimpleEventService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly simpleEventRepo: SimpleEventRepository,
    private readonly massiveEventRepo: MassiveEventRepository,
  ) {}

  /**
   * Create a SimpleEvent
   * @param idTenant - The tenant ID
   * @param dto - The data transfer object containing the event date and simple events
   * @returns The created SimpleEvent
   */
  async createSimpleEvent(
    idTenant: string,
    dto: CreateSimpleEventDto,
  ) {
    const massiveEvent = await this.massiveEventRepo.findById(dto.idMassiveEvent, idTenant);
    if (!massiveEvent) {
      throw new NotFoundException(`MassiveEvent ${dto.idMassiveEvent} not found`);
    }
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
   * Get a SimpleEvent by ID
   * @param idTenant - The tenant ID
   * @param id - The SimpleEvent ID
   * @returns The SimpleEvent
   */
  async findById(idTenant: string, id: string) {
    return this.simpleEventRepo.findById(id);
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
}
