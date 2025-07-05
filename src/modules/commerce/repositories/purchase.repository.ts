import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Purchase } from '../entities/purchase.entity';

@Injectable()
export class PurchaseRepository {
  private readonly repository: Repository<Purchase>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Purchase);
  }

  createInstance(data: Partial<Purchase>): Purchase {
    return this.repository.create(data);
  }

  async save(purchase: Purchase): Promise<Purchase> {
    return this.repository.save(purchase);
  }

  async saveWithManager(manager: EntityManager, purchase: Purchase): Promise<Purchase> {
    return manager.save(Purchase, purchase);
  }

  async findById(id: string, idTenant: string): Promise<Purchase | null> {
    return this.repository.findOne({
      where: { id, idTenant },
      relations: ['lots'],
    });
  }

  async deleteById(id: string, idTenant: string): Promise<void> {
    await this.repository.delete({ id, idTenant });
  }
}
