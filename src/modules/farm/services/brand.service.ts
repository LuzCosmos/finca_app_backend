import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BrandRepository } from '../repositories/brand.repository';
import { Brand } from '../entities/brand.entity';
import { BrandResponseDto } from '../dto/brand-response.dto';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { SyncBrandDto } from '../dto/sync-brand.dto';
import { SyncBrandResultDto } from '../dto/sync-brand.dto';

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
    const brand = {
      id: dto.id,
      idTenant,
      name: dto.name,
      imageUrl: dto.imageUrl ?? undefined,
    }
    return await this.brandRepository.create(brand);
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

  async syncBrands(idTenant: string, brands: SyncBrandDto[]): Promise<SyncBrandResultDto[]> {
    const results: SyncBrandResultDto[] = [];
  
    for (const b of brands) {
      try {
        // ¿Existe ya un brand con el mismo nombre para este tenant?
        const existing = await this.brandRepository.findByName(idTenant, b.name);
        if (existing) {
          results.push({ id: b.id, status: 'synced', serverId: existing.id });
          continue;
        }
  
        // Crear el brand usando el id proporcionado desde frontend
        const brand = await this.brandRepository.create({
          id: b.id,
          idTenant,
          name: b.name,
          imageUrl: b.imageUrl ?? undefined,
        });
        results.push({ id: b.id, status: 'synced', serverId: brand.id });
      } catch (error) {
        results.push({ id: b.id, status: 'failed', message: error.message });
      }
    }
  
    return results;
  }
  
}
