import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BrandRepository } from '../repositories/brand.repository';
import { Brand } from '../entities/brand.entity';
import { BrandResponseDto } from '../dto/brand-response.dto';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';

@Injectable()
export class BrandService {
  constructor(
    private readonly brandRepository: BrandRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Crear una nueva marca
   */
  async create(idTenant: string, dto: CreateBrandDto): Promise<Brand> {
    dto.idTenant = idTenant;
    return await this.brandRepository.create(dto);
  }

  /**
   * Obtener todas las marcas por tenant
   */
  async findAll(idTenant: string): Promise<Brand[]> {
    return await this.brandRepository.findAll(idTenant);
  }

  /**
   * Obtener una marca específica
   */
  async findOne(idTenant: string, id: string): Promise<Brand> {
    const brand = await this.brandRepository.findOne(idTenant, id);
    if (!brand) {
      throw new NotFoundException(`Brand ${id} not found`);
    }
    return brand;
  }

  /**
   * Actualizar una marca
   */
  async update(idTenant: string, id: string, dto: UpdateBrandDto): Promise<Brand> {
    const updated = await this.brandRepository.update(idTenant, id, dto);
    if (!updated) {
      throw new NotFoundException(`Brand ${id} not found`);
    }
    return updated;
  }

  /**
   * Eliminar una marca
   */
  async remove(idTenant: string, id: string): Promise<void> {
    await this.brandRepository.delete(idTenant, id);
  }

  /**
   * Ejemplo de uso con transacción (si necesitas operaciones complejas)
   */
  async createWithTransaction(idTenant: string, dto: CreateBrandDto): Promise<Brand> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      dto.idTenant = idTenant;
      return await this.brandRepository.createWithManager(dto as any, manager);
    });
  }
}
