import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, QueryFailedError, Repository, IsNull } from 'typeorm';
import { Cattle, CattleStatus } from '../entities/cattle.entity';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';
import { CattleCharacteristic } from '../entities/cattle-characteristic.entity';


type PagedInput = {
  idTenant: string;
  limit: number;
  cursor?: string;
  updatedAfter?: Date;
};

type CattleBasicSyncItem = {
  idTenant: string;
  id: string;
  number: string;
  sysNumber: string;
  idDevice: string | null;
  eartagLeft: string | null;
  eartagRight: string | null;
  castrated: boolean;
  hasHorns: boolean;
  color: string;
  updatedAt: string;
};

type PagedOutput = {
  items: CattleBasicSyncItem[];
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

  async findOne(idTenant: string, id: string, manager?: EntityManager): Promise<Cattle | null> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    return repo.findOne({ where: { idTenant, id } });
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

  /*async findByIdPurchaseWithoutLot(idTenant: string, idPurchase: string, manager?: EntityManager): Promise<Cattle[]> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    return repo.find({
      where: { idTenant, idPurchase, idLot: IsNull() },
      relations: ['device'],
      order: { number: 'ASC' }
    });
  }*/

  async findByIdPurchaseWithoutLot(
    idTenant: string,
    idPurchase: string,
    manager?: EntityManager,
  ): Promise<Cattle[]> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    const qb = repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.device', 'd')
      .where('c.idTenant = :idTenant', { idTenant })
      .andWhere('c.idPurchase = :idPurchase', { idPurchase })
      .andWhere('c.idLot IS NULL');
    qb.addSelect(
      `CASE 
        WHEN c.number ~ '^[0-9]+$' THEN c.number::int
        ELSE NULL
      END`,
      'number_sort',
    );
    qb.orderBy('number_sort', 'ASC');
    qb.addOrderBy('c.number', 'ASC');
    return qb.getMany();
  }

  async findByIdLot(idTenant: string, idLot: string, manager?: EntityManager): Promise<Cattle[]> {
    /*const repo = manager?.getRepository(Cattle) ?? this.repository;
    return repo.find({ where: { idTenant, idLot }, relations: ['device'], order: { number: 'ASC' } });*/
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    const qb = repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.device', 'd')
      .where('c.idTenant = :idTenant', { idTenant })
      .andWhere('c.idLot = :idLot', { idLot })
    qb.addSelect(
      `CASE 
        WHEN c.number ~ '^[0-9]+$' THEN c.number::int
        ELSE NULL
      END`,
      'number_sort',
    );
    qb.orderBy('number_sort', 'ASC');
    qb.addOrderBy('c.number', 'ASC');
    return qb.getMany();
  }

  async findAll(idTenant: string): Promise<Cattle[]> {
    return this.repository.find({
      where: { idTenant },
      relations: ['cattleCharacteristics', 'device'],
      order: { number: 'ASC' }
    });
  }

  async update(idTenant: string, id: string, cattleDto: UpdateCattleDto, manager?: EntityManager): Promise<Cattle | null> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    const m = manager ?? this.repository.manager;
    if (cattleDto.characteristics) {
      await m.delete(CattleCharacteristic, { idCattle: id, idTenant: idTenant });
      const charEntities = cattleDto.characteristics.map(charName => m.create(CattleCharacteristic, {
        idTenant: idTenant as any,
        idCattle: id,
        characteristic: charName as any
      }));
      await m.save(CattleCharacteristic, charEntities);
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

  async findOneForUpdateByNumberAndStatuses(idTenant: string, number: string, statuses: CattleStatus[], manager: EntityManager): Promise<Cattle | null> {
    try {
      return manager.getRepository(Cattle).findOne({
        where: { idTenant, number, status: In(statuses) },
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

  async findByAnyEartag(idTenant: string, eartag: string, manager?: EntityManager): Promise<Cattle | null> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    return repo
      .createQueryBuilder('c')
      .where('c.idTenant = :idTenant', { idTenant })
      .andWhere('(c.eartagLeft = :eartag OR c.eartagRight = :eartag)', { eartag })
      .getOne();
  }

  async getBasicInfo(idTenant: string, manager?: EntityManager): Promise<Cattle[]> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    return repo.find({
      where: { idTenant },
      select: {
        id: true,
        number: true,
        sysNumber: true,
      }
    });
  }

  async listPaged(
    idTenant: string,
    query: any,
    page: number,
    limit: number,
    manager?: EntityManager,
  ): Promise<{ rows: Cattle[]; total: number }> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    const qb = repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.cattleCharacteristics', 'cc')
      .leftJoinAndSelect('c.device', 'd')
      .addSelect(`CASE WHEN c.number ~ '^[0-9]+$' THEN c.number::int ELSE NULL END`, 'numeric_number')
      .where('c.idTenant = :idTenant', { idTenant })
      .orderBy('c.status', 'ASC')
      .addOrderBy('numeric_number', 'ASC')
      .addOrderBy('c.number', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();
    return { rows, total };
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
      .select([
        'c.id',
        'c.idTenant',
        'c.number',
        'c.sysNumber',
        'c.idDevice',
        'c.eartagLeft',
        'c.eartagRight',
        'c.castrated',
        'c.hasHorn',
        'c.color',
        'c.updatedAt',
      ])
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
    // Map a DTO ligero (hasHorns alinea con columna has_horns / propiedad hasHorn)
    const items = pageItems.map((r) => ({
      idTenant: r.idTenant,
      id: r.id,
      number: r.number,
      sysNumber: r.sysNumber,
      idDevice: r.idDevice ?? null,
      eartagLeft: r.eartagLeft ?? null,
      eartagRight: r.eartagRight ?? null,
      castrated: r.castrated,
      hasHorns: r.hasHorn,
      color: r.color,
      updatedAt: r.updatedAt.toISOString(),
    }));
    return {
      items,
      nextCursor,
      hasMore,
      total: null, // opcional: puedes calcularlo sólo en la primera página si necesitas
    };
  }

  nextCandidateCattleNumber(number: string): string {
    if (!number) throw new Error('Cattle number is empty');
    // 1) Termina en dígitos → incrementa sufijo
    const trailing = number.match(/^(.*?)(\d+)$/);
    if (trailing) {
      const prefix = trailing[1];
      const numericPart = trailing[2];
      const next = (Number(numericPart) + 1)
        .toString()
        .padStart(numericPart.length, '0');
      return `${prefix}${next}`;
    }
    // 2) Empieza con dígitos → incrementa prefijo
    const leading = number.match(/^(\d+)(.*)$/);
    if (leading) {
      const numericPart = leading[1];
      const suffix = leading[2];
      const next = (Number(numericPart) + 1)
        .toString()
        .padStart(numericPart.length, '0');
      return `${next}${suffix}`;
    }
    // 3) No tiene dígitos → TORO → TORO1
    return `${number}1`;
  }

  async getSuggestNextNumber(
    idTenant: string,
    number: string,
    manager?: EntityManager,
  ): Promise<string> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    let candidate = this.nextCandidateCattleNumber(number);
    const MAX_TRIES = 5000;
    for (let i = 0; i < MAX_TRIES; i++) {
      const isTaken = await repo.existsBy({
        idTenant,
        status: CattleStatus.ACTIVE,
        number: candidate,
      });
      if (!isTaken) {
        return candidate;
      }
      candidate = this.nextCandidateCattleNumber(candidate);
    }
    throw new Error(
      `Could not find a free cattle number after ${MAX_TRIES} attempts starting from "${number}"`,
    );
  }

  async lockForTenant(tenantId: string, manager?: EntityManager): Promise<void> {
    const m = manager ?? this.repository;
    await m.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${tenantId}:cattle_number`]);
  }

  async search(idTenant: string, query: string, statuses: CattleStatus[], manager?: EntityManager): Promise<Cattle[]> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    const qb = repo.createQueryBuilder('c')
      .leftJoinAndSelect('c.device', 'd')
      .where('c.idTenant = :idTenant', { idTenant })
      .andWhere('c.status IN (:...statuses)', { statuses })
      .andWhere(
        '(c.number ILIKE :query OR c.eartagLeft ILIKE :query OR c.eartagRight ILIKE :query OR d.name ILIKE :query OR d.deveui ILIKE :query)',
        { query: `%${query}%` }
      )
      .limit(20);

    return qb.getMany();
  }
}
