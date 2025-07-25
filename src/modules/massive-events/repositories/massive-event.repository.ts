import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { MassiveEvent } from '../entities/massive-events.entity';

@Injectable()
export class MassiveEventRepository {
  private readonly logger = new Logger(MassiveEventRepository.name);
  private readonly repository: Repository<MassiveEvent>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(MassiveEvent);
  }

  createInstance(data: Partial<MassiveEvent>): MassiveEvent {
    return this.repository.create(data);
  }

  async save(entity: MassiveEvent): Promise<MassiveEvent> {
    return this.repository.save(entity);
  }

  async saveWithManager(manager: EntityManager, entity: MassiveEvent): Promise<MassiveEvent> {
    return manager.save(MassiveEvent, entity);
  }

  async findById(id: string, idTenant: string): Promise<MassiveEvent> {
    const event = await this.repository.findOne({ where: { id, idTenant } });
    if (!event) throw new NotFoundException('MassiveEvent not found');
    return event;
  }

  async findOneWithSimpleEvents(idTenant: string, idMassiveEvent: string): Promise<MassiveEvent | null> {
    return this.repository.findOne({
      where: { idTenant, id: idMassiveEvent },
      relations: ['simpleEvents'],
    });
  }

  async findAllByTenant(idTenant: string): Promise<MassiveEvent[]> {
    return this.repository.find({ where: { idTenant } });
  }

  async deleteById(id: string, idTenant: string): Promise<void> {
    await this.repository.delete({ id, idTenant });
  }

  async deleteByIdWithManager(manager: EntityManager, id: string, idTenant: string): Promise<void> {
    await manager.delete(MassiveEvent, { id, idTenant });
  }
}
