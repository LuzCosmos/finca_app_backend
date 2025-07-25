import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { SimpleEventCattle } from '../entities/simple-event-cattle.entity';

@Injectable()
export class SimpleEventCattleRepository {
  private readonly logger = new Logger(SimpleEventCattleRepository.name);
  private readonly repository: Repository<SimpleEventCattle>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(SimpleEventCattle);
  }

  createInstance(data: Partial<SimpleEventCattle>): SimpleEventCattle {
    return this.repository.create(data);
  }

  async save(entity: SimpleEventCattle): Promise<SimpleEventCattle> {
    return this.repository.save(entity);
  }

  async saveWithManager(manager: EntityManager, entity: SimpleEventCattle): Promise<SimpleEventCattle> {
    return manager.save(SimpleEventCattle, entity);
  }

  async findById(id: string): Promise<SimpleEventCattle> {
    const item = await this.repository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('SimpleEventCattle not found');
    return item;
  }

  async findByCattle(idTenant: string, idCattle: string): Promise<SimpleEventCattle[]> {
    return this.repository.find({ where: { idTenant, idCattle } });
  }

  async findBySimpleEvent(idSimpleEvent: string): Promise<SimpleEventCattle[]> {
    return this.repository.find({ where: { idSimpleEvent } });
  }

  async findBySimpleEvents(idTenant: string, simpleEventIds: string[]): Promise<SimpleEventCattle[]> {
    return this.repository.find({ where: { idTenant, idSimpleEvent: In(simpleEventIds) } });
  }  

  async deleteById(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async deleteByIdWithManager(manager: EntityManager, id: string): Promise<void> {
    await manager.delete(SimpleEventCattle, { id });
  }
}
