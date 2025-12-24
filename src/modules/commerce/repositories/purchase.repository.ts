import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Purchase } from '../entities/purchase.entity';
import { PurchaseListQueryDto } from '../dto/purchase-list.query.dto';
import { PurchaseListItemDto } from '../dto/purchase-list.item.dto';


type RawRow = {
  id: string;
  purchaseDate: Date | string;
  providerName?: string | null;
  totalCattle: number | string | null;
  totalWeight: number | string | null;
  receivedCattle: number | string | null;
  receivedWeight: number | string | null;
};

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

  async findById(id: string, idTenant: string, manager?: EntityManager): Promise<Purchase | null> {
    const repo = manager?.getRepository(Purchase) ?? this.repository;
    return repo.findOne({
      where: { id, idTenant },
      relations: ['lots'],
    });
  }

  async deleteById(id: string, idTenant: string): Promise<void> {
    await this.repository.delete({ id, idTenant });
  }

  async listPaged(tenantId: string, q: PurchaseListQueryDto, page: number, limit: number) {
    const { from, to, provider, status = 'all' } = q;
    const qb = this.repository.createQueryBuilder('p')
      .leftJoin('providers', 'prov', 'prov.id = p.id_provider')
      // lot_agg
      .leftJoin(
        qb1 => qb1
          .subQuery()
          .select('lot.id_purchase', 'id_purchase')
          .addSelect('SUM(lot.cattle_count)', 'total_cattle')
          .addSelect('SUM(lot.total_weight)', 'total_weight')
          .addSelect('SUM(lot.received_cattle_count)', 'received_cattle_lot')
          .from('lots', 'lot')
          .groupBy('lot.id_purchase'),
        'lot_agg',
        'lot_agg.id_purchase = p.id',
      )
      // c_agg
      .leftJoin(
        qb2 => qb2
          .subQuery()
          .select('c.id_purchase', 'id_purchase')
          .addSelect('COUNT(*)', 'received_cattle_no_lot')
          .from('cattle', 'c')
          .where('c.id_lot IS NULL')
          .groupBy('c.id_purchase'),
        'c_agg',
        'c_agg.id_purchase = p.id',
      )
      .where('p.id_tenant = :tenantId', { tenantId });

    if (from) qb.andWhere('p.purchase_date >= :from', { from });
    if (to) qb.andWhere('p.purchase_date <= :to', { to });
    if (provider) qb.andWhere('prov.name ILIKE :prov', { prov: `%${provider}%` });

    qb.select([
      'p.id AS id',
      'p.purchase_date AS "purchaseDate"',
      'prov.name AS "providerName"',
      'COALESCE(lot_agg.total_cattle, 0) AS "totalCattle"',
      'COALESCE(lot_agg.total_weight, 0) AS "totalWeight"',
      'COALESCE(lot_agg.received_cattle_lot, 0) AS "receivedCattleLot"',
      'COALESCE(c_agg.received_cattle_no_lot, 0) AS "receivedCattleNoLot"',
      '(COALESCE(lot_agg.received_cattle_lot, 0) + COALESCE(c_agg.received_cattle_no_lot, 0)) AS "receivedCattle"',
    ]);

    // status ahora es WHERE normal (no HAVING)
    if (status === 'open') {
      qb.andWhere(
        '(COALESCE(lot_agg.received_cattle_lot, 0) + COALESCE(c_agg.received_cattle_no_lot, 0)) < COALESCE(lot_agg.total_cattle, 0)',
      );
    } else if (status === 'received') {
      qb.andWhere(
        '(COALESCE(lot_agg.received_cattle_lot, 0) + COALESCE(c_agg.received_cattle_no_lot, 0)) >= COALESCE(lot_agg.total_cattle, 0)',
      );
    }

    // Total (rápido, sin traer todo)
    const totalRaw = await qb.clone()
      .select('COUNT(DISTINCT p.id)', 'cnt')
      .offset(undefined)
      .limit(undefined)
      .orderBy()
      .getRawOne<{ cnt: string }>();

    const total = Number(totalRaw?.cnt ?? 0);

    // Paginación
    qb.orderBy('p.purchase_date', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const rows = await qb.getRawMany();

    return { total, rows };
  }
}
