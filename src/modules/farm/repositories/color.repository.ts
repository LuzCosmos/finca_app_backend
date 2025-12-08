import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Color } from '../entities/color.entity';

@Injectable()
export class ColorRepository extends Repository<Color> {
  constructor(private readonly dataSource: DataSource) {
    super(Color, dataSource.createEntityManager());
  }

  async listActive(tenantId: string, manager?: EntityManager): Promise<Color[]> {
    const m = manager ?? this.manager;
    return m.find(Color, { where: { idTenant: { id: tenantId } as any, isActive: true }, order: { name: 'ASC' } as any });
  }

  async getByNameCI(tenantId: string, name: string, manager?: EntityManager): Promise<Color | null> {
    const m = manager ?? this.manager;
    return m
      .createQueryBuilder(Color, 'c')
      .where('c.idTenant = :tenantId', { tenantId })
      .andWhere('LOWER(c.name) = LOWER(:name)', { name })
      .getOne();
  }

  async getOrCreateByNameCI(tenantId: string, name: string, manager?: EntityManager): Promise<Color> {
    const m = manager ?? this.manager;
    const existing = await this.getByNameCI(tenantId, name, m);
    if (existing) return existing;
    const created = m.create(Color, { idTenant: { id: tenantId } as any, name, isActive: true });
    return m.save(Color, created);
  }
}
