import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SimpleEvent } from '../entities/simple-event.entity';

@Injectable()
export class SimpleEventRepository {
  private readonly logger = new Logger(SimpleEventRepository.name);
  private readonly repository: Repository<SimpleEvent>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(SimpleEvent);
  }

  createInstance(data: Partial<SimpleEvent>): SimpleEvent {
    return this.repository.create(data);
  }

  async save(entity: SimpleEvent): Promise<SimpleEvent> {
    return this.repository.save(entity);
  }

  async saveWithManager(manager: EntityManager, entity: SimpleEvent): Promise<SimpleEvent> {
    return manager.save(SimpleEvent, entity);
  }

  async findById(id: string): Promise<SimpleEvent> {
    const se = await this.repository.findOne({ where: { id } });
    if (!se) throw new NotFoundException('SimpleEvent not found');
    return se;
  }

  async findByMassiveEvent(idTenant: string, idMassiveEvent: string) {
    return this.repository.find({ where: { idTenant, idMassiveEvent } });
  }

  async deleteById(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async deleteByIdWithManager(manager: EntityManager, id: string): Promise<void> {
    await manager.delete(SimpleEvent, { id });
  }

  async deleteByMassiveEvent(manager: EntityManager, idMassiveEvent: string): Promise<void> {
    await manager.delete(SimpleEvent, { idMassiveEvent });
  }
}
