import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { RolesService } from './roles.service';
import { UsersService } from './users.service';
import { ModulesService } from './modules.service';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly rolesService: RolesService,
    private readonly usersService: UsersService,
    private readonly modulesService: ModulesService,
  ) {}

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Verificar si ya existe un tenant con el mismo nombre
    const existingTenant = await this.tenantRepository.findOne({
      where: [
        { name: createTenantDto.name },
        { company_username: createTenantDto.company_username }
      ]
    });

    if (existingTenant) {
      throw new ConflictException('Ya existe un tenant con ese nombre o username de compañía');
    }

    // Crear el tenant
    const tenant = this.tenantRepository.create(createTenantDto);
    await this.tenantRepository.save(tenant);

    // Crear el usuario admin
    const adminUser = await this.usersService.createAdminUser({
      username: createTenantDto.admin_username,
      password: createTenantDto.admin_password,
      email: createTenantDto.admin_email,
      firstName: createTenantDto.admin_first_name,
      lastName: createTenantDto.admin_last_name,
      tenantId: tenant.id
    });

    // Obtener todos los módulos disponibles
    const allModules = await this.modulesService.findAll();

    // Asignar permisos completos para todos los módulos al rol de admin
    for (const module of allModules) {
      await this.rolesService.createPermission(
        adminUser.roles[0].id, // Asumimos que el primer rol es el de admin
        tenant.id,
        module.id,
        {
          can_create: true,
          can_read: true,
          can_update: true,
          can_delete: true
        }
      );
    }

    return tenant;
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find();
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant con ID ${id} no encontrado`);
    }
    return tenant;
  }

  async update(id: string, updateTenantDto: Partial<CreateTenantDto>): Promise<Tenant> {
    const tenant = await this.findOne(id);
    this.tenantRepository.merge(tenant, updateTenantDto);
    return this.tenantRepository.save(tenant);
  }

  async remove(id: string): Promise<void> {
    const result = await this.tenantRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Tenant con ID ${id} no encontrado`);
    }
  }
} 