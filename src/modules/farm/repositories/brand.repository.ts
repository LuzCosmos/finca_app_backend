import { Injectable, BadRequestException,ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, ILike } from 'typeorm';
import { Brand } from '../entities/brand.entity';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BrandRepository {
  constructor(
    @InjectRepository(Brand)
    private readonly repo: Repository<Brand>,
  ) {}

  /**
   * Crear una nueva marca
   */
  async create(dto: Partial<Brand>): Promise<Brand> {
    if (!('id' in dto) || dto.id == null || dto.id == undefined ) {
      dto.id = uuidv4(); 
    }
    const entity = this.repo.create(dto);
    return await this.repo.save(entity);
  }

  /**
   * Crear una nueva marca usando transacción
   */
  async createWithManager(dto: CreateBrandDto, manager: EntityManager): Promise<Brand> {
    if (!('id' in dto) || dto.id == null || dto.id == undefined ) {
      dto.id = uuidv4(); 
    }
    const entity = manager.create(Brand, dto);
    return await manager.save(entity);
  }

  /**
   * Obtener todas las marcas de un tenant
   */
  async findAll(idTenant: string): Promise<Brand[]> {
    return await this.repo.find({
      where: { idTenant },
      order: { name: 'ASC' },
    });
  }

  /**
   * Obtener una marca específica
   */
  async findOne(idTenant: string, id: string, manager?: EntityManager): Promise<Brand | null> {
    const repo = manager?.getRepository(Brand) ?? this.repo;
    return await repo.findOne({ where: { idTenant, id }, select: ['id', 'idTenant', 'name', 'createdAt', 'updatedAt', 'image'], });
  }

  /**
   * Obtener una marca específica por nombre
   */
  async findByName(idTenant: string, name: string, manager?: EntityManager): Promise<Brand | null> {
    const repo = manager?.getRepository(Brand) ?? this.repo;
    return await repo.findOne({ where: { idTenant, name: ILike(name) } });
  }

  /**
   * Actualizar una marca
   */
  async update(idTenant: string, id: string, dto: UpdateBrandDto, imageFile?: Express.Multer.File, manager?: EntityManager): Promise<Brand | null> {
    const repo = manager?.getRepository(Brand) ?? this.repo;
    const existing = await repo.findOne({ where: { idTenant, id } });
    if (!existing) return null;
    Object.assign(existing, dto);
    if (imageFile) {
      existing.image = imageFile.buffer;
      existing.imageMimeType = imageFile.mimetype;
    }
    return await repo.save(existing);
  }

  /**
   * Eliminar una marca
   */
  async delete(idTenant: string, id: string, manager?: EntityManager): Promise<void> {
    const repo = manager?.getRepository(Brand) ?? this.repo;
    await repo.delete({ idTenant, id });
  }
}
