import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Characteristic } from '../entities/characteristic.entity';

@Injectable()
export class CharacteristicRepository extends Repository<Characteristic> {
  constructor(private readonly dataSource: DataSource) {
    super(Characteristic, dataSource.createEntityManager());
  }

  async listActive(tenantId: string, manager?: EntityManager): Promise<Characteristic[]> {
    const m = manager ?? this.manager;
    return m.find(Characteristic, {
      where: { idTenant: { id: tenantId } as any, isActive: true },
      order: { groupName: 'ASC', name: 'ASC' } as any,
    });
  }

  async findManyByTenantAndIds(tenantId: string, ids: string[], manager?: EntityManager): Promise<Characteristic[]> {
    const m = manager ?? this.manager;
    if (!ids?.length) return [];
    return m.find(Characteristic, { where: { idTenant: { id: tenantId } as any, id: In(ids) } });
  }

  async getOrCreateByNameCI(tenantId: string, name: string, groupName?: string, manager?: EntityManager): Promise<Characteristic> {
    const m = manager ?? this.manager;
    const existing = await m
      .createQueryBuilder(Characteristic, 'ch')
      .where('ch.idTenant = :tenantId', { tenantId })
      .andWhere('LOWER(ch.name) = LOWER(:name)', { name })
      .getOne();
    if (existing) return existing;
    const created = m.create(Characteristic, { idTenant: { id: tenantId } as any, name, groupName, isActive: true });
    return m.save(Characteristic, created);
  }
}
