import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Lot } from '../entities/lot.entity';

@Injectable()
export class LotRepository {
  private readonly repository: Repository<Lot>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Lot);
  }

  createInstance(data: Partial<Lot>): Lot {
    return this.repository.create(data);
  }

  async save(lot: Lot): Promise<Lot> {
    return this.repository.save(lot);
  }

  async saveWithManager(manager: EntityManager, lot: Lot): Promise<Lot> {
    return manager.save(Lot, lot);
  }

  async deleteByPurchaseId(idPurchase: string, idTenant: string): Promise<void> {
    await this.repository.delete({ idPurchase, idTenant });
  }

  async deleteByPurchaseIdWithManager(manager: EntityManager, idPurchase: string, idTenant: string): Promise<void> {
    await manager.delete(Lot, { idPurchase, idTenant });
  }

  async findByPurchaseId(idPurchase: string, idTenant: string): Promise<Lot[]> {
    return this.repository.find({ where: { idPurchase, idTenant } });
  }

  async findById(id: string, idTenant: string): Promise<Lot> {
    const lot = await this.repository.findOne({ where: { id, idTenant } });
    if (!lot) {
      throw new NotFoundException('Lot not found');
    }
    return lot;
  }
}
