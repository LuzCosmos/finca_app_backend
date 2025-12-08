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

    // Query base con agregados
    const qb = this.repository.createQueryBuilder('p')
      .leftJoin('providers', 'prov', 'prov.id = p.id_provider')
      .leftJoin('lots', 'lot', 'lot.id_purchase = p.id')
      .leftJoin('cattle', 'c', 'c.id_purchase = p.id')
      .where('p.id_tenant = :tenantId', { tenantId });

    if (from) qb.andWhere('p.purchase_date >= :from', { from });
    if (to) qb.andWhere('p.purchase_date <= :to', { to });
    if (provider) qb.andWhere('(prov.name ILIKE :prov)', { prov: `%${provider}%` });

    qb.select([
      'p.id AS id',
      'p.purchase_date AS "purchaseDate"',
      'prov.name AS "providerName"',
      // SUM(lot.cattle_count) / SUM(lot.total_weight) pueden ser NULL => COALESCE
      'COALESCE(SUM(lot.cattle_count), 0) AS "totalCattle"',
      'COALESCE(SUM(lot.total_weight), 0) AS "totalWeight"',
      'COALESCE(COUNT(c.id), 0) AS "receivedCattle"',
      'COALESCE(SUM(c.received_weight), 0) AS "receivedWeight"',
    ])
      .groupBy('p.id, prov.name, p.purchase_date');

    // Filtro por status usando HAVING sobre agregados
    if (status === 'open') {
      qb.having('COALESCE(COUNT(c.id), 0) < COALESCE(SUM(lot.cattle_count), 0)');
    } else if (status === 'received') {
      qb.having('COALESCE(COUNT(c.id), 0) >= COALESCE(SUM(lot.cattle_count), 0)');
    }

    // Contar total de grupos (compras) con mismos filtros (sin paginar)
    const totalQb = this.repository.createQueryBuilder('p')
      .leftJoin('providers', 'prov', 'prov.id = p.id_provider')
      .leftJoin('lots', 'lot', 'lot.id_purchase = p.id')
      .leftJoin('cattle', 'c', 'c.id_purchase = p.id')
      .where('p.id_tenant = :tenantId', { tenantId });
    if (from) totalQb.andWhere('p.purchase_date >= :from', { from });
    if (to) totalQb.andWhere('p.purchase_date <= :to', { to });
    if (provider) totalQb.andWhere('(prov.name ILIKE :prov)', { prov: `%${provider}%` });
    totalQb.select('p.id').groupBy('p.id');

    if (status === 'open') {
      totalQb.having('COALESCE(COUNT(c.id), 0) < COALESCE(SUM(lot.cattle_count), 0)');
    } else if (status === 'received') {
      totalQb.having('COALESCE(COUNT(c.id), 0) >= COALESCE(SUM(lot.cattle_count), 0)');
    }

    const total = (await totalQb.getRawMany()).length;

    // Orden + paginación
    qb.orderBy('p.purchase_date', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const rows = (await qb.getRawMany()) as RawRow[];

    return { total, rows };
  }
}
