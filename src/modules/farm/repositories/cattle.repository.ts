import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, QueryFailedError, Repository, IsNull } from 'typeorm';
import { Cattle } from '../entities/cattle.entity';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';
import { CattleCharacteristic } from '../entities/cattle-characteristic.entity';


type PagedInput = {
  idTenant: string;
  limit: number;
  cursor?: string;
  updatedAfter?: Date;
};

type PagedOutput = {
  items: Array<Pick<Cattle, 'id' | 'number' | 'sysNumber'>>;
  nextCursor: string | null;
  hasMore: boolean;
  total: number | null; // opcional, aquí lo dejamos null para no encarecer
};

@Injectable()
export class CattleRepository {
  constructor(
    @InjectRepository(Cattle)
    private readonly repository: Repository<Cattle>,
  ) { }

  async create(cattleDto: CreateCattleDto, manager?: EntityManager): Promise<Cattle> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    const entity = (repo.create(cattleDto as any) as unknown) as Cattle;
    return repo.save(entity);
  }

  async save(cattle: Cattle): Promise<Cattle> {
    return this.repository.save(cattle);
  }

  async saveWithManager(manager: EntityManager, cattle: Cattle): Promise<Cattle> {
    return manager.save(Cattle, cattle);
  }

  async findOne(idTenant: string, id: string): Promise<Cattle | null> {
    return this.repository.findOne({ where: { idTenant, id } });
  }

  async findOneWithManager(manager: EntityManager, idTenant: string, id: string): Promise<Cattle | null> {
    return manager.findOne(Cattle, { where: { idTenant, id } });
  }

  async unsetDevice(idTenant: string, idDevice: string, manager?: EntityManager): Promise<void> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    await repo.update({ idTenant, idDevice }, { idDevice: null });
  }

  async findById(idTenant: string, id: string, manager?: EntityManager): Promise<Cattle | null> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    return repo.findOne({ where: { idTenant, id } });
  }
  async findByIds(idTenant: string, ids: string[]): Promise<Cattle[]> {
    return this.repository.find({ where: { idTenant, id: In(ids) } });
  }

  async findByIdPurchaseWithoutLot(idTenant: string, idPurchase: string, manager?: EntityManager): Promise<Cattle[]> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    return repo.find({ where: { idTenant, idPurchase, idLot: IsNull() }, relations: ['device'] });
  }

  async findByIdLot(idTenant: string, idLot: string, manager?: EntityManager): Promise<Cattle[]> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    return repo.find({ where: { idTenant, idLot }, relations: ['device'] });
  }

  async findAll(idTenant: string): Promise<Cattle[]> {
    return this.repository.find({
      where: { idTenant },
      relations: ['cattleCharacteristics', 'device'],
      order: { createdAt: 'DESC' }
    });
  }

  async update(idTenant: string, id: string, cattleDto: UpdateCattleDto, manager?: EntityManager): Promise<Cattle | null> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    const m = manager ?? this.repository.manager;

    // Handle characteristics update manually if present
    if (cattleDto.characteristics) {
      await m.delete(CattleCharacteristic, { idCattle: id, idTenant: idTenant });

      const charEntities = cattleDto.characteristics.map(charName => m.create(CattleCharacteristic, {
        idTenant: idTenant as any,
        idCattle: id,
        characteristic: charName as any
      }));
      await m.save(CattleCharacteristic, charEntities);

      // Remove characteristics from DTO to avoid issues with repo.update if strictly typed (though we use any)
      delete cattleDto.characteristics;
    }

    await repo.update({ idTenant, id }, cattleDto as any);
    return this.findOne(idTenant, id);
  }

  async delete(idTenant: string, id: string): Promise<void> {
    await this.repository.delete({ idTenant, id });
  }

  async findBySysNumberAndTenantId(idTenant: string, sysNumber: string, manager?: EntityManager): Promise<Cattle | null> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    return repo.findOne({ where: { idTenant, sysNumber } });
  }

  async findByNumberAndTenantId(idTenant: string, number: string, manager?: EntityManager): Promise<Cattle | null> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    return repo.findOne({ where: { idTenant, number } });
  }

  async findOneForUpdateByNumber(idTenant: string, number: string, manager: EntityManager): Promise<Cattle | null> {
    try {
      return manager.getRepository(Cattle).findOne({
        where: { idTenant, number },
        lock: { mode: 'pessimistic_write' },
      });
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const pgCode = err.driverError?.code as string | undefined;
        if (pgCode === '55P03') { // Locked
          throw new HttpException('Resource is locked', HttpStatus.LOCKED); // 423
        }
        if (pgCode === '40P01') { // Deadlock
          throw new ConflictException('A deadlock occurred, please retry.');
        }
      }
      throw err;
    }
  }

  findByEartag(idTenant: string, eartag: string): Promise<Cattle | null> {
    return this.repository.findOne({ where: { idTenant, eartag } });
  }

  getBasicInfo(idTenant: string): Promise<Cattle[]> {
    return this.repository.find({
      where: { idTenant },
      select: {
        id: true,
        number: true,
        sysNumber: true,
      }
    });
  }

  async getBasicInfoPaged(input: PagedInput): Promise<PagedOutput> {
    const { idTenant, limit, cursor, updatedAfter } = input;

    // Decode cursor (base64 JSON: { updatedAt: string, id: string })
    let lastUpdatedAt: Date | null = null;
    let lastId: string | null = null;
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        if (decoded?.updatedAt) lastUpdatedAt = new Date(decoded.updatedAt);
        if (decoded?.id) lastId = String(decoded.id);
      } catch {
        // cursor inválido: lo ignoramos para empezar desde el principio
      }
    }

    // Query base
    const qb = this.repository
      .createQueryBuilder('c')
      .where('c.idTenant = :idTenant', { idTenant });

    // Delta-sync
    if (updatedAfter) {
      qb.andWhere('c.updatedAt > :updatedAfter', { updatedAfter });
    }

    // Cursor (orden estable por updatedAt asc, id asc)
    if (lastUpdatedAt && lastId) {
      qb.andWhere(
        '(c.updatedAt > :lastUpdatedAt OR (c.updatedAt = :lastUpdatedAt AND c.id > :lastId))',
        { lastUpdatedAt, lastId },
      );
    }

    qb
      .select(['c.id', 'c.number', 'c.sysNumber', 'c.updatedAt'])
      .orderBy('c.updatedAt', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .limit(limit + 1); // pedimos uno extra para saber si hay más

    const rows = await qb.getMany();

    // Cortar a "limit" y construir nextCursor
    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore) {
      const last = pageItems[pageItems.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ updatedAt: last.updatedAt.toISOString(), id: last.id }),
        'utf8',
      ).toString('base64');
    }

    // Map a DTO ligero
    const items = pageItems.map(r => ({
      idTenant: r.idTenant,
      id: r.id,
      number: r.number,
      sysNumber: (r as any).sysNumber,
    }));

    return {
      items,
      nextCursor,
      hasMore,
      total: null, // opcional: puedes calcularlo sólo en la primera página si necesitas
    };
  }






  async lockForTenant(tenantId: string, manager?: EntityManager): Promise<void> {
    const m = manager ?? this.repository;
    await m.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${tenantId}:cattle_number`]);
  }

  /**
   * Devuelve el primer número libre >= from, considerando SOLO status='active'.
   */
  async suggestNextNumber(tenantId: string, from: bigint, manager?: EntityManager): Promise<string> {
    const m = manager ?? this.repository.manager;
    await this.lockForTenant(tenantId, m);

    const rows = await m.query(
      `SELECT number::bigint AS n
         FROM public.cattle
        WHERE id_tenant = $1
          AND status = 'active'
          AND number ~ '^[1-9][0-9]*$'
          AND number::bigint >= $2
        ORDER BY number::bigint
        LIMIT 1000`,
      [tenantId, from.toString()],
    );

    let candidate = from;
    for (const r of rows) {
      const n = BigInt(r.n);
      if (n === candidate) candidate++;
      else if (n > candidate) break;
    }
    return candidate.toString();
  }

  /**
   * Crea un bovino status='active' reservando número >= baseNumber de forma consistente.
   * Retorna el número asignado y la entidad.
   */
  async createActiveWithAutoNumber(params: {
    tenantId: string;
    baseNumber: string; // validado: ^[1-9]\d*$
    payload: Partial<Cattle>; // otros campos (purchase, lot, weights, etc.)
  }, manager?: EntityManager): Promise<{ entity: Cattle; numberAssigned: string }> {
    const m = manager ?? this.repository.manager;
    await this.lockForTenant(params.tenantId, m);

    let candidate = BigInt(params.baseNumber);
    // primer hueco libre
    candidate = BigInt(await this.suggestNextNumber(params.tenantId, candidate, m));

    let saved: Cattle | null = null;
    for (let tries = 0; tries < 4; tries++) {
      try {
        const ent = m.create(Cattle, {
          ...params.payload,
          idTenant: { id: params.tenantId } as any,
          number: candidate.toString(),
          status: 'active' as any,
        });
        saved = await m.save(Cattle, ent);
        break;
      } catch (e: any) {
        const msg = String(e?.message ?? '');
        if (msg.includes('uq_cattle_tenant_number_active') || msg.includes('duplicate key')) {
          candidate++;
          continue;
        }
        throw e;
      }
    }
    if (!saved) throw new Error('No se pudo reservar un número de res libre.');

    return { entity: saved, numberAssigned: candidate.toString() };
  }

  async assignLot(cattleId: string, lotId: string, manager?: EntityManager): Promise<void> {
    const m = manager ?? this.repository.manager;
    await m.query(
      `UPDATE public.cattle SET id_lot = $2 WHERE id = $1`,
      [cattleId, lotId],
    );
    // recalcular métricas del lote (cant/avg) en SQL si quieres aquí
  }

  async changeStatus(cattleId: string, status: 'active' | 'sold' | 'dead' | 'lost', manager?: EntityManager): Promise<void> {
    const m = manager ?? this.repository.manager;
    await m.update(Cattle, { id: cattleId }, { status: status as any } as any);
  }


}
