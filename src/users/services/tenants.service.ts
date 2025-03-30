import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { Tenant } from '../entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private tenantsRepository: Repository<Tenant>
  ) {}

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    try {
      const tenant = this.tenantsRepository.create(createTenantDto);
      return await this.tenantsRepository.save(tenant);
    } catch (error) {
      if (error.code === '23505') { // Código de error de PostgreSQL para violación de unique constraint
        throw new ConflictException('El nombre de usuario de la compañía ya existe');
      }
      throw error;
    }
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantsRepository.find();
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant con ID ${id} no encontrado`);
    }
    return tenant;
  }

  async update(id: string, updateTenantDto: Partial<CreateTenantDto>): Promise<Tenant> {
    try {
      const tenant = await this.findOne(id);
      this.tenantsRepository.merge(tenant, updateTenantDto);
      return await this.tenantsRepository.save(tenant);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('El nombre de usuario de la compañía ya existe');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.tenantsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Tenant con ID ${id} no encontrado`);
    }
  }
} 