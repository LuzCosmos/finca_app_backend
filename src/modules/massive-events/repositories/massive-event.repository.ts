import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { MassiveEvent } from '../entities/massive-events.entity';
import { MassiveEventListQueryDto } from '../dto/massive-event-list.query.dto';

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

  async updateByIdWithManager(manager: EntityManager, id: string, idTenant: string, data: Partial<MassiveEvent>): Promise<void> {
    await manager.update(MassiveEvent, { id, idTenant }, data);
  }

  async findById(idTenant: string, id: string, manager?: EntityManager): Promise<MassiveEvent | null> {
    const repo = manager?.getRepository(MassiveEvent) ?? this.repository;
    return await repo.findOne({ where: { id, idTenant } });
  }

  async findOneWithSimpleEvents(idTenant: string, idMassiveEvent: string, manager?: EntityManager): Promise<MassiveEvent | null> {
    const repo = manager?.getRepository(MassiveEvent) ?? this.repository;
    return await repo.findOne({
      where: { idTenant, id: idMassiveEvent },
      relations: ['simpleEvents'],
    });
  }

  async findAllByTenant(idTenant: string): Promise<MassiveEvent[]> {
    return this.repository.find({ where: { idTenant } });
  }

  /**
   * Masivos “autónomos” del módulo: excluye recepciones (flag + ausencia en purchase_receptions).
   */
  async findStandaloneMassiveEventsByTenant(idTenant: string): Promise<MassiveEvent[]> {
    return this.repository
      .createQueryBuilder('me')
      .where('me.idTenant = :idTenant', { idTenant })
      .andWhere('me.linkedToPurchaseReception = :standalone', { standalone: false })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM purchase_receptions pr
          WHERE pr.id_massive_event = me.id AND pr.id_tenant = :idTenant
        )`,
        { idTenant },
      )
      .orderBy('me.eventDate', 'DESC')
      .addOrderBy('me.name', 'ASC')
      .addOrderBy('me.updatedAt', 'DESC')
      .getMany();
  }

  /**
   * Listado autónomo paginado (mismos criterios que {@link findStandaloneMassiveEventsByTenant} + filtros opcionales).
   */
  async findStandaloneMassiveEventsPaged(
    idTenant: string,
    q: Pick<
      MassiveEventListQueryDto,
      'page' | 'limit' | 'from' | 'to' | 'name' | 'status' | 'sortBy' | 'sortDir'
    >,
  ): Promise<{ items: MassiveEvent[]; total: number }> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(500, Math.max(1, q.limit ?? 10));

    const qb = this.repository
      .createQueryBuilder('me')
      .where('me.idTenant = :idTenant', { idTenant })
      .andWhere('me.linkedToPurchaseReception = :standalone', { standalone: false })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM purchase_receptions pr
          WHERE pr.id_massive_event = me.id AND pr.id_tenant = :idTenant
        )`,
        { idTenant },
      );

    if (q.from) {
      qb.andWhere('CAST(me.eventDate AS date) >= CAST(:fromDate AS date)', { fromDate: q.from });
    }
    if (q.to) {
      qb.andWhere('CAST(me.eventDate AS date) <= CAST(:toDate AS date)', { toDate: q.to });
    }
    const nameTrim = q.name?.trim();
    if (nameTrim) {
      const term = `%${nameTrim}%`;
      qb.andWhere('(me.name ILIKE :nameTerm OR CAST(me.id AS TEXT) ILIKE :nameTerm)', { nameTerm: term });
    }
    const st = (q.status ?? 'all').toLowerCase();
    if (st === 'open' || st === 'closed') {
      qb.andWhere('LOWER(me.status) = :statusFilter', { statusFilter: st });
    }

    const total = await qb.clone().getCount();

    const sortCol =
      {
        eventDate: 'me.eventDate',
        name: 'me.name',
        status: 'me.status',
        createdAt: 'me.createdAt',
        updatedAt: 'me.updatedAt',
      }[q.sortBy ?? 'eventDate'] ?? 'me.eventDate';
    const sortDir = (q.sortDir ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const idRows = await qb
      .clone()
      .select('me.id')
      .orderBy(sortCol, sortDir)
      .addOrderBy('me.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const idList = idRows.map(r => r.id);
    if (idList.length === 0) {
      return { items: [], total };
    }

    const items = await this.repository.find({
      where: { id: In(idList), idTenant },
      relations: ['simpleEvents'],
    });
    const rank = new Map(idList.map((id, idx) => [id, idx]));
    items.sort((a, b) => (rank.get(a.id)! - rank.get(b.id)!));

    return { items, total };
  }

  async existsPurchaseReceptionForMassive(idTenant: string, idMassiveEvent: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM purchase_receptions pr
       WHERE pr.id_tenant = $1 AND pr.id_massive_event = $2 LIMIT 1`,
      [idTenant, idMassiveEvent],
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  async deleteById(id: string, idTenant: string): Promise<void> {
    await this.repository.delete({ id, idTenant });
  }

  async deleteByIdWithManager(manager: EntityManager, id: string, idTenant: string): Promise<void> {
    await manager.delete(MassiveEvent, { id, idTenant });
  }
}
