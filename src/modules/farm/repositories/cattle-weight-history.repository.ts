import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { CattleWeightHistory, WeightContext } from '../entities/cattle-weight-history.entity';

@Injectable()
export class CattleWeightHistoryRepository {
  private readonly logger = new Logger(CattleWeightHistoryRepository.name);
  constructor(
    @InjectRepository(CattleWeightHistory)
    private readonly repo: Repository<CattleWeightHistory>,
  ) { }

  async create(entity: CattleWeightHistory, manager?: EntityManager): Promise<CattleWeightHistory> {
    var repo = this.repo;
    if (manager) {
      repo = manager.getRepository(CattleWeightHistory);
    }
    return await repo.save(entity);
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
    manager?: EntityManager,
    context?: WeightContext,
  ): Promise<CattleWeightHistory[]> {
    var repo = this.repo;
    if (manager) {
      repo = manager.getRepository(CattleWeightHistory);
    }
    if (!context) {
      return await repo.find({
        where: { idTenant, idCattle },
        order: { date: 'ASC' },
      });
    } else {
      return await repo.find({
        where: { idTenant, idCattle, context },
        order: { date: 'ASC' },
      });
    }
  }

  /** Registro de peso más reciente (por fecha DESC) para calcular ganancia diaria. */
  async findLastByCattle(
    idTenant: string,
    idCattle: string,
    manager?: EntityManager,
  ): Promise<CattleWeightHistory | null> {
    const repo = manager ? manager.getRepository(CattleWeightHistory) : this.repo;
    const list = await repo.find({
      where: { idTenant, idCattle },
      order: { date: 'DESC' },
      take: 1,
    });
    return list[0] ?? null;
  }

  /**
   * Último peso registrado **antes** del evento masivo indicado (excluye filas de ese masivo).
   * Usado en `GET .../applied-animals` para `previousWeight` al rehidratar sesión.
   */
  async findPreviousWeightsBeforeMassiveEvent(
    idTenant: string,
    idCattleList: string[],
    idMassiveEvent: string,
    manager?: EntityManager,
  ): Promise<Map<string, number>> {
    const uniqueIds = [...new Set(idCattleList.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const repo = manager ? manager.getRepository(CattleWeightHistory) : this.repo;
    const rows = await repo
      .createQueryBuilder('cwh')
      .where('cwh.id_tenant = :idTenant', { idTenant })
      .andWhere('cwh.id_cattle IN (:...ids)', { ids: uniqueIds })
      .andWhere('(cwh."idMassiveEvent" IS NULL OR cwh."idMassiveEvent" != :idMassiveEvent)', {
        idMassiveEvent,
      })
      .orderBy('cwh.date', 'DESC')
      .getMany();

    const byCattle = new Map<string, number>();
    for (const row of rows) {
      if (!byCattle.has(row.idCattle) && row.weight != null) {
        byCattle.set(row.idCattle, Number(row.weight));
      }
    }
    return byCattle;
  }

  async findOneById(
    idTenant: string,
    id: string,
  ): Promise<CattleWeightHistory | null> {
    return await this.repo.findOne({ where: { idTenant, id } });
  }

  async update(entity: CattleWeightHistory, manager?: EntityManager): Promise<CattleWeightHistory> {
    var repo = this.repo;
    if (manager) {
      repo = manager.getRepository(CattleWeightHistory);
    }
    return await repo.save(entity);
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
