import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from '../entities/role.entity';
import { RoleModulePermission } from '../entities/role-module-permission.entity';
import { ModuleEntity } from '../entities/module.entity';
import { User } from '../entities/user.entity';
import { ModuleAction } from '../../auth/types/module-action.type';

interface CreatePermissionDto {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

@Injectable()
export class RolesService {
  private rolesModuleId: string;
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(RoleModulePermission)
    private readonly permissionRepository: Repository<RoleModulePermission>,
    @InjectRepository(ModuleEntity)
    private readonly moduleRepository: Repository<ModuleEntity>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {this.initializeRolesModuleId()}

  private async initializeRolesModuleId() {
    const employeeManagementModule = await this.moduleRepository.findOne({ 
      where: { name: 'Employee Management' } 
    });
    
    if (!employeeManagementModule) {
      throw new Error('Módulo Employee Management no encontrado');
    }
    this.rolesModuleId = employeeManagementModule.id;
  }

  async findAll(user: User): Promise<Role[]> {
    // Primero verificamos si el usuario tiene permiso de lectura
    const hasPermission = await this.hasPermission(
      user,
      this.rolesModuleId,
      'read'
    );

    if (!hasPermission) {
      throw new ForbiddenException('No tienes permisos para ver roles');
    }

    // Obtenemos los roles con sus permisos
    const roles = await this.roleRepository.find({
      relations: ['permissions', 'permissions.module']
    });

    return roles;
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ 
      where: { id },
      relations: ['permissions', 'permissions.module']
    });
    if (!role) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }
    return role;
  }

  async findByName(name: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ 
      where: { name },
      relations: ['permissions', 'permissions.module']
    });
    if (!role) {
      throw new NotFoundException(`Rol con nombre ${name} no encontrado`);
    }
    return role;
  }

  // Métodos para gestión de permisos (CRUDL)
  async createPermission(
    roleId: string,
    tenantId: string,
    moduleId: string,
    permissionDto: CreatePermissionDto
  ): Promise<RoleModulePermission> {
    // Verificar si ya existe el permiso
    const existingPermission = await this.permissionRepository.findOne({
      where: {
        id_role: roleId,
        tenant_id: tenantId,
        id_module: moduleId
      }
    });

    if (existingPermission) {
      throw new ConflictException('El permiso ya existe para este rol, módulo y tenant');
    }

    // Crear el nuevo permiso
    const permission = this.permissionRepository.create({
      id_role: roleId,
      tenant_id: tenantId,
      id_module: moduleId,
      ...permissionDto
    });

    return this.permissionRepository.save(permission);
  }

  async updatePermission(
    roleId: string,
    tenantId: string,
    moduleId: string,
    permissionDto: Partial<CreatePermissionDto>
  ): Promise<RoleModulePermission> {
    const permission = await this.permissionRepository.findOne({
      where: {
        id_role: roleId,
        tenant_id: tenantId,
        id_module: moduleId
      }
    });

    if (!permission) {
      throw new NotFoundException('Permiso no encontrado');
    }

    this.permissionRepository.merge(permission, permissionDto);
    return this.permissionRepository.save(permission);
  }

  async deletePermission(roleId: string, tenantId: string, moduleId: string): Promise<void> {
    const result = await this.permissionRepository.delete({
      id_role: roleId,
      tenant_id: tenantId,
      id_module: moduleId
    });

    if (result.affected === 0) {
      throw new NotFoundException('Permiso no encontrado');
    }
  }

  async listPermissions(roleId: string, tenantId: string): Promise<RoleModulePermission[]> {
    return this.permissionRepository.find({
      where: {
        id_role: roleId,
        tenant_id: tenantId
      },
      relations: ['module']
    });
  }

  // Métodos de verificación de permisos
  async getAccessibleModules(user: User): Promise<ModuleEntity[]> {
    const permissions = await this.permissionRepository
      .createQueryBuilder('permission')
      .leftJoinAndSelect('permission.module', 'module')
      .where('permission.id_role IN (:...roleIds)', {
        roleIds: user.roles.map(role => role.id),
      })
      .andWhere('permission.tenant_id = :tenantId', { tenantId: user.tenant.id })
      .getMany();

    const moduleIds = new Set(permissions.map(p => p.module.id));
    return this.moduleRepository.findByIds([...moduleIds]);
  }

  async hasPermission(
    user: User,
    moduleId: string,
    action: ModuleAction
  ): Promise<boolean> {
    // Aseguramos que el usuario tenga roles cargados
    if (!user.roles || user.roles.length === 0) {
      return false;
    }

    // Verificamos que los roles tengan la relación con los permisos
    const userWithRoles = await this.userRepository.findOne({
      where: { id: user.id },
      relations: ['roles']
    });

    if (!userWithRoles || !userWithRoles.roles || userWithRoles.roles.length === 0) {
      return false;
    }

    const roleIds = userWithRoles.roles.map(role => role.id);

    const permissions = await this.permissionRepository.find({
      where: {
        id_role: In(roleIds),
        tenant_id: user.tenantId,
        id_module: moduleId
      }
    });

    // Si algún rol tiene el permiso, retornamos true
    return permissions.some(permission => permission[`can_${action}`]);
  }




}