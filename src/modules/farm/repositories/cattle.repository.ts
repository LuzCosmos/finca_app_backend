import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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
    const cattle = repo.create(cattleDto);
    return repo.save(cattle);
  }

  async findOne(idTenant: string, id: string): Promise<Cattle | undefined> {
    const cattle = await this.repository.findOne({ where: { idTenant, id } });
    return cattle || undefined;
  }

  async findAll(idTenant: string): Promise<Cattle[]> {
    return this.repository.find({ where: { idTenant } });
  }

  async update(idTenant: string, id: string, cattleDto: UpdateCattleDto, manager?: EntityManager): Promise<Cattle | undefined> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    await repo.update(id, cattleDto);
    const updatedCattle = await this.findOne(idTenant, id);
    return updatedCattle || undefined;
  }

  async delete(idTenant: string, id: string): Promise<void> {
    await this.repository.delete({ idTenant, id });
  }

  async findBySysNumberAndTenantId(idTenant: string, sysNumber: string): Promise<Cattle | undefined> {
    const cattle = await this.repository.findOne({ where: { idTenant, sysNumber } });
    return cattle || undefined;
  }

  async findByNumberAndTenantId(idTenant: string, number: string): Promise<Cattle | undefined> {
    const cattle = await this.repository.findOne({ where: { idTenant, number } });
    return cattle || undefined;
  }
  
}
