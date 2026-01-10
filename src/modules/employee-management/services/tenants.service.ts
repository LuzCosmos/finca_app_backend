import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { RoleService } from './roles.service';
import { UsersService } from './users.service';
import { ModulesService } from './modules.service';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { RoleModulePermissionService } from './role-module-permission.services';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigurationsService } from 'src/modules/configurations/services/configurations.service';

@Injectable()
export class TenantsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly rolesService: RoleService,
    private readonly RoleModulePermissionService: RoleModulePermissionService,
    private readonly usersService: UsersService,
    private readonly modulesService: ModulesService,
    private readonly configurationsService: ConfigurationsService,
  ) { }

  /**
   * Create a tenant
   * @param createTenantDto - The DTO of the tenant to create
   * @returns The tenant created
   */
  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    return this.dataSource.transaction(async (manager) => {
      console.log('createTenantDto', createTenantDto);
      const tenantRepo = manager.getRepository(Tenant);
      const existingTenant = await tenantRepo.findOne({
        where: {
          name: createTenantDto.name,
          company_username: createTenantDto.company_username
        }
      });

      if (existingTenant) {
        throw new ConflictException('Ya existe un tenant con ese nombre o username de compañía');
      }
      // Crear el tenant
      const tenant = tenantRepo.create(createTenantDto);
      await tenantRepo.save(tenant);

      // Crear el usuario admin
      const adminUser = await this.usersService.createAdminUser(
        {
          username: createTenantDto.admin_username,
          password: createTenantDto.admin_password,
          email: createTenantDto.admin_email,
          firstName: createTenantDto.admin_first_name,
          lastName: createTenantDto.admin_last_name,
          tenantId: tenant.id
        },
        manager);
      // Obtener todos los módulos disponibles
      const allModules = await this.modulesService.findAll();
      // Asignar permisos completos para todos los módulos al rol de admin
      for (const module of allModules) {
        const sys_admin_role = await this.rolesService.findByCode('SYS_ADMIN', manager);
        let permission = new CreatePermissionDto();
        permission.moduleId = module.id;
        permission.roleId = sys_admin_role.id;
        permission.can_create = true;
        permission.can_read = true;
        permission.can_update = true;
        permission.can_delete = true;
        permission.can_list = true;
        await this.RoleModulePermissionService.createPermission(tenant.id, permission, manager);
      }
      await this.configurationsService.createTenantDefaults(tenant.id, manager);
      return tenant;
    });
  }

  /**
   * Find all tenants
   * @returns The tenants found
   */
  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find();
  }

  /**
   * Find a tenant by its ID
   * @param id - The ID of the tenant
   * @returns The tenant found
   */
  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }
    return tenant;
  }

  /**
   * Update a tenant
   * @param id - The ID of the tenant
   * @param updateTenantDto - The DTO of the tenant to update
   * @returns The tenant updated
   */
  async update(id: string, updateTenantDto: Partial<CreateTenantDto>): Promise<Tenant> {
    const tenant = await this.findOne(id);
    this.tenantRepository.merge(tenant, updateTenantDto);
    return this.tenantRepository.save(tenant);
  }
  /*
    async remove(id: string): Promise<void> {
      const result = await this.tenantRepository.delete(id);
      if (result.affected === 0) {
        throw new NotFoundException(`Tenant with ID ${id} not found`);
      }
    }
  */
  /**
   * Find a tenant by its company_username
   * @param company_username - The company_username of the tenant
   * @returns The tenant found
   */
  async findByCompanyUsername(company_username: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { company_username }
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with company_username ${company_username} not found`);
    }
    return tenant;
  }
} 