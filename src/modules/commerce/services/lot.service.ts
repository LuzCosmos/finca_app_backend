import { Injectable, NotFoundException } from '@nestjs/common';
import { LotRepository } from '../repositories/lot.repository';
import { Lot } from '../entities/lot.entity';

@Injectable()
export class LotService {
  constructor(private readonly lotRepository: LotRepository) {}

  async findByPurchaseId(idPurchase: string, idTenant: string): Promise<Lot[]> {
    return this.lotRepository.findByPurchaseId(idPurchase, idTenant);
  }

  async findOne(id: string, idTenant: string): Promise<Lot> {
    const lot = await this.lotRepository.findById(id, idTenant);
    if (!lot) {
      throw new NotFoundException('Lot not found');
    }
    return lot;
  }
}
