import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { CattleWeightHistory } from '../entities/cattle-weight-history.entity';

@Injectable()
export class CattleWeightHistoryRepository {
  private readonly logger = new Logger(CattleWeightHistoryRepository.name);
  constructor(
    @InjectRepository(CattleWeightHistory)
    private readonly repo: Repository<CattleWeightHistory>,
  ) {}

  async create(entity: CattleWeightHistory): Promise<CattleWeightHistory> {
    return await this.repo.save(entity);
  }

  async createWithManager(
    manager: EntityManager,
    entity: CattleWeightHistory,
  ): Promise<CattleWeightHistory> {
    this.logger.debug('GUARDAR HISTORIA DE PESO');
    this.logger.debug(entity);
    return await manager.save(CattleWeightHistory, entity);
  }

  async findByCattle(
    idTenant: string,
    idCattle: string,
  ): Promise<CattleWeightHistory[]> {
    return await this.repo.find({
      where: { idTenant, idCattle },
      order: { date: 'DESC' },
    });
  }

  async findOneById(
    idTenant: string,
    id: string,
  ): Promise<CattleWeightHistory | null> {
    return await this.repo.findOne({ where: { idTenant, id } });
  }

  async update(entity: CattleWeightHistory): Promise<CattleWeightHistory> {
    return await this.repo.save(entity);
  }

  async updateWithManager(
    manager: EntityManager,
    entity: CattleWeightHistory,
  ): Promise<CattleWeightHistory> {
    return await manager.save(CattleWeightHistory, entity);
  }

  async deleteById(idTenant: string, id: string): Promise<void> {
    await this.repo.delete({ idTenant, id });
  }

  async deleteByIdWithManager(
    idTenant: string,
    id: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager.delete(CattleWeightHistory, { idTenant, id });
  }
}
