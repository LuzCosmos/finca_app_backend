import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cattle, CattleStatus } from '../../farm/entities/cattle.entity';

export type CattleAdgRow = {
  averageDailyGain: number | null;
};

@Injectable()
export class GeneralReportsRepository {
  constructor(
    @InjectRepository(Cattle)
    private readonly cattleRepository: Repository<Cattle>,
  ) {}

  async countByStatus(idTenant: string, status: CattleStatus): Promise<number> {
    return this.cattleRepository.count({ where: { idTenant, status } });
  }

  async countOnFeedActiveSold(idTenant: string): Promise<number> {
    return this.cattleRepository
      .createQueryBuilder('c')
      .where('c.id_tenant = :idTenant', { idTenant })
      .andWhere('c.status IN (:...statuses)', {
        statuses: [CattleStatus.ACTIVE, CattleStatus.SOLD],
      })
      .andWhere('c.new_feed_start_date IS NOT NULL')
      .getCount();
  }

  async findActiveSoldAdgRows(idTenant: string): Promise<CattleAdgRow[]> {
    const rows = await this.cattleRepository
      .createQueryBuilder('c')
      .select('c.average_daily_gain', 'averageDailyGain')
      .where('c.id_tenant = :idTenant', { idTenant })
      .andWhere('c.status IN (:...statuses)', {
        statuses: [CattleStatus.ACTIVE, CattleStatus.SOLD],
      })
      .getRawMany<{ averageDailyGain: string | null }>();

    return rows.map((row) => ({
      averageDailyGain:
        row.averageDailyGain != null ? Number(row.averageDailyGain) : null,
    }));
  }
}
