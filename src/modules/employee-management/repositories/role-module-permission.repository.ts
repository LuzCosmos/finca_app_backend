import { DataSource, DeleteResult, EntityManager, Repository } from 'typeorm';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { RoleModulePermission } from '../entities/role-module-permission.entity';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';

@Injectable()
export class RoleModulePermissionRepository extends Repository<RoleModulePermission> {
  constructor(private dataSource: DataSource) {
    super(RoleModulePermission, dataSource.createEntityManager());
  }

  /**
   * Find all role module permissions by tenantId
   * @param roleIds - The IDs of the roles
   * @param tenantId - The ID of the tenant
   * @returns The role module permissions found
   */
  async findByRolesAndTenant(roleIds: string[], tenantId: string, manager?: EntityManager): Promise<RoleModulePermission[]> {
    const repository = manager?.getRepository(RoleModulePermission) || this;
    try {
      const query = repository.createQueryBuilder('roleModulePermission')
        .select([
          'roleModulePermission.id_role',
          'roleModulePermission.id_module',
          'roleModulePermission.can_create',
          'roleModulePermission.can_read',
          'roleModulePermission.can_update',
          'roleModulePermission.can_delete',
          'roleModulePermission.can_list',
          'module.code',
          'module.access_details'
        ])
        .innerJoinAndSelect('roleModulePermission.module', 'module')
        .where('roleModulePermission.id_role IN (:...roleIds)', { roleIds })
        .andWhere('roleModulePermission.tenant_id = :tenantId', { tenantId });
      const permissions = await query.getMany();
      return permissions;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error en la base de datos',
        { cause: error.message }
      );
    }
  }

  /**
   * Find a role module permission by roleId, moduleId and tenantId
   * @param roleId - The ID of the role
   * @param moduleId - The ID of the module
   * @param tenantId - The ID of the tenant
   * @returns The role module permission found
   */
  async findByRoleAndModuleAndTenant(roleId: string, moduleId: string, tenantId: string, manager?: EntityManager): Promise<RoleModulePermission | null> {
    const repository = manager?.getRepository(RoleModulePermission) || this;
    try {
      /*const query = this.createQueryBuilder('roleModulePermission')
        .where('roleModulePermission.tenant_id = :tenantId', { tenantId })
        .andWhere('roleModulePermission.id_role = :roleId', { roleId })
        .andWhere('roleModulePermission.id_module = :tenantId', { tenantId });
      const permissions = await query.getOne();*/
      const permission = await repository.findOne({
        where: {
          tenant_id: tenantId,
          id_role: roleId,
          id_module: moduleId
        }
      });
      return permission;
    } catch (error) {
      throw new InternalServerErrorException('Error in data base', { cause: error.message });
    }
  }

  /**
   * Create a role module permission
   * @param tenantId - The ID of the tenant
   * @param createPermissionDto - The DTO of the permission to create
   * @returns The role module permission created
   */
  async createRoleModulePermission(tenantId: string, createPermissionDto: CreatePermissionDto, manager?: EntityManager): Promise<RoleModulePermission> {
    const repository = manager?.getRepository(RoleModulePermission) || this;
    try {
      const permission = repository.create({
        tenant_id: tenantId,
        id_role: createPermissionDto.roleId,
        id_module: createPermissionDto.moduleId,
        can_create: createPermissionDto.can_create,
        can_read: createPermissionDto.can_read,
        can_update: createPermissionDto.can_update,
        can_delete: createPermissionDto.can_delete,
        can_list: createPermissionDto.can_list
      });
      return repository.save(permission);
    } catch (error) {
      throw new InternalServerErrorException('Error in data base', { cause: error.message });
    }
  }

  /**
   * Update a role module permission
   * @param permission - The role module permission to update
   * @param updatePermissionDto - The DTO of the permission to update
   * @returns The role module permission updated
   */
  async updateRoleModulePermission(permission: RoleModulePermission, updatePermissionDto: UpdatePermissionDto, manager?: EntityManager): Promise<RoleModulePermission> {
    const repository = manager?.getRepository(RoleModulePermission) || this;
    this.merge(permission, updatePermissionDto);
    return repository.save(permission);
  }

  /**
   * Delete a role module permission
   * @param roleId - The ID of the role
   * @param moduleId - The ID of the module
   * @param tenantId - The ID of the tenant
   * @returns The result of the deletion
   */
  async deleteRoleModulePermission(roleId: string, moduleId: string, tenantId: string, manager?: EntityManager): Promise<DeleteResult> {
    const repository = manager?.getRepository(RoleModulePermission) || this;
    const result = await repository.delete({
      id_role: roleId,
      tenant_id: tenantId,
      id_module: moduleId
    });
    return result
  }

  /**
   * Find all role module permissions by roleId and tenantId
   * @param roleId - The ID of the role
   * @param tenantId - The ID of the tenant
   * @returns The role module permissions found
   */
  async findByRoleAndTenant(roleId: string, tenantId: string, manager?: EntityManager): Promise<RoleModulePermission[]> {
    const repository = manager?.getRepository(RoleModulePermission) || this;
    return repository.find({
      where: {
        id_role: roleId,
        tenant_id: tenantId
      },
      relations: ['module']
    });
  }

}