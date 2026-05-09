import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CattleAgeHistory } from '../entities/cattle-age-history.entity';

@Injectable()
export class CattleAgeHistoryRepository {
  constructor(
    @InjectRepository(CattleAgeHistory)
    private readonly repo: Repository<CattleAgeHistory>,
  ) {}

  async createWithManager(manager: EntityManager, entity: CattleAgeHistory): Promise<CattleAgeHistory> {
    return manager.save(CattleAgeHistory, entity);
  }

  async findByCattle(idTenant: string, idCattle: string, manager?: EntityManager): Promise<CattleAgeHistory[]> {
    const r = manager ? manager.getRepository(CattleAgeHistory) : this.repo;
    return r.find({
      where: { idTenant, idCattle },
      order: { createdAt: 'DESC' },
    });
  }
}
