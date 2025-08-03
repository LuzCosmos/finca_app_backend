import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AnimalSimpleEvent } from '../entities/animal-simple-event.entity';

@Injectable()
export class AnimalSimpleEventRepository {
  private readonly logger = new Logger(AnimalSimpleEventRepository.name);
  private readonly repository: Repository<AnimalSimpleEvent>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(AnimalSimpleEvent);
  }

  createInstance(data: Partial<AnimalSimpleEvent>): AnimalSimpleEvent {
    return this.repository.create(data);
  }

  async save(entity: AnimalSimpleEvent): Promise<AnimalSimpleEvent> {
    return this.repository.save(entity);
  }

  async saveWithManager(manager: EntityManager, entity: AnimalSimpleEvent): Promise<AnimalSimpleEvent> {
    return manager.save(AnimalSimpleEvent, entity);
  }

  async findById(id: string): Promise<AnimalSimpleEvent> {
    const item = await this.repository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('AnimalSimpleEvent not found');
    return item;
  }

  async findByCattle(idTenant: string, idCattle: string): Promise<AnimalSimpleEvent[]> {
    return this.repository.find({ where: { idTenant, idAnimal: idCattle } });
  }

  async findBySimpleEvent(idSimpleEvent: string): Promise<AnimalSimpleEvent[]> {
    return this.repository.find({ where: { idSimpleEvent } });
  }

  async findBySimpleEvents(idTenant: string, simpleEventIds: string[]): Promise<AnimalSimpleEvent[]> {
    return this.repository.find({ where: { idTenant, idSimpleEvent: In(simpleEventIds) } });
  }  

  async deleteById(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async deleteByIdWithManager(manager: EntityManager, id: string): Promise<void> {
    await manager.delete(AnimalSimpleEvent, { id });
  }
}
