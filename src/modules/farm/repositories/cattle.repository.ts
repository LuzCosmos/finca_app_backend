import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import { Cattle } from '../entities/cattle.entity';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';

@Injectable()
export class CattleRepository {
  constructor(
    @InjectRepository(Cattle)
    private readonly repository: Repository<Cattle>,
  ) {}

  async create(cattleDto: CreateCattleDto, manager?: EntityManager): Promise<Cattle> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    const entity = repo.create(cattleDto);
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
    await repo.update({idTenant,idDevice}, {idDevice: null});
  } 

  async findByIds(idTenant: string, ids: string[]): Promise<Cattle[]> {
    return this.repository.find({ where: { idTenant, id: In(ids) } });
  }

  async findAll(idTenant: string): Promise<Cattle[]> {
    return this.repository.find({ where: { idTenant } });
  }

  async update(idTenant: string, id: string, cattleDto: UpdateCattleDto, manager?: EntityManager): Promise<Cattle | null> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    await repo.update({ idTenant, id }, cattleDto);
    return this.findOne(idTenant, id);
  }

  async delete(idTenant: string, id: string): Promise<void> {
    await this.repository.delete({ idTenant, id });
  }

  async findBySysNumberAndTenantId(idTenant: string, sysNumber: string): Promise<Cattle | null> {
    return this.repository.findOne({ where: { idTenant, sysNumber } });
  }

  async findByNumberAndTenantId(idTenant: string, number: string, manager?: EntityManager): Promise<Cattle | null> {
    return this.repository.findOne({ where: { idTenant, number } });
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
}
