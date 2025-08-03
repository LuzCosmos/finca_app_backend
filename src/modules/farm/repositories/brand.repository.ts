import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Brand } from '../entities/brand.entity';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';

@Injectable()
export class BrandRepository {
  constructor(
    @InjectRepository(Brand)
    private readonly repo: Repository<Brand>,
  ) {}

  /**
   * Crear una nueva marca
   */
  async create(dto: CreateBrandDto): Promise<Brand> {
    const entity = this.repo.create(dto);
    return await this.repo.save(entity);
  }

  /**
   * Crear una nueva marca usando transacción
   */
  async createWithManager(dto: CreateBrandDto, manager: EntityManager): Promise<Brand> {
    const entity = manager.create(Brand, dto);
    return await manager.save(entity);
  }

  /**
   * Obtener todas las marcas de un tenant
   */
  async findAll(idTenant: string): Promise<Brand[]> {
    return await this.repo.find({ where: { idTenant } });
  }

  /**
   * Obtener una marca específica
   */
  async findOne(idTenant: string, id: string): Promise<Brand | null> {
    return await this.repo.findOne({ where: { idTenant, id } });
  }

  /**
   * Obtener una marca específica por nombre
   */
  async findByName(idTenant: string, name: string): Promise<Brand | null> {
    return await this.repo.findOne({ where: { idTenant, name } });
  }

  /**
   * Actualizar una marca
   */
  async update(idTenant: string, id: string, dto: UpdateBrandDto, manager?: EntityManager): Promise<Brand | null> {
    const repo = manager?.getRepository(Brand) ?? this.repo;
    const existing = await repo.findOne({ where: { idTenant, id } });
    if (!existing) return null;
    const updated = Object.assign(existing, dto);
    return await repo.save(updated);
  }

  /**
   * Eliminar una marca
   */
  async delete(idTenant: string, id: string, manager?: EntityManager): Promise<void> {
    const repo = manager?.getRepository(Brand) ?? this.repo;
    await repo.delete({ idTenant, id });
  }
}
