import { ConflictException, Injectable, NotFoundException,Logger } from "@nestjs/common";
import { RoleModulePermissionRepository } from "../repositories/role-module-permission.repository";
import { RoleModulePermission } from "../entities/role-module-permission.entity";
import { CreatePermissionDto } from "../dto/create-permission.dto";
import { UpdatePermissionDto } from "../dto/update-permission.dto";
import { RoleReadPermissionDto } from "../dto/role-read-permission.dto";

@Injectable()
export class RoleModulePermissionService {
  private readonly logger = new Logger(RoleModulePermissionService.name);
  constructor(
    private readonly roleModulePermissionRepository: RoleModulePermissionRepository
  ) {}

  /**
   * Get all role module permissions by roleIds and tenantId
   * @param roleIds - The IDs of the roles
   * @param tenantId - The ID of the tenant
   * @returns The role module permissions found
   */ 
  async getByRolesAndTenant(roleIds: string[], tenantId: string): Promise<RoleModulePermission[]> {
    const roleModulePermissions = await this.roleModulePermissionRepository.findByRolesAndTenant(roleIds, tenantId);
    return roleModulePermissions;
  }

  /**
   * Create a role module permission
   * @param tenantId - The ID of the tenant
   * @param permissionDto - The DTO of the permission to create
   * @returns The role module permission created
   */ 
  async createPermission(tenantId:string,permissionDto: CreatePermissionDto): Promise<RoleModulePermission> {
    // Verificar si ya existe el permiso
    const existingPermission = await this.roleModulePermissionRepository.findByRoleAndModuleAndTenant(tenantId, permissionDto.roleId, permissionDto.moduleId);
    if (existingPermission) {
      throw new ConflictException('The permission exist for this role and module');
    }
    return this.roleModulePermissionRepository.createRoleModulePermission(tenantId, permissionDto)
  }

  /**
   * Update a role module permission
   * @param roleId - The ID of the role
   * @param tenantId - The ID of the tenant
   * @param moduleId - The ID of the module
   * @param permissionDto - The DTO of the permission to update
   * @returns The role module permission updated
   */  
  async updatePermission(roleId: string,tenantId: string,moduleId: string,permissionDto:UpdatePermissionDto): Promise<RoleModulePermission> {
    const permission = await this.roleModulePermissionRepository.findByRoleAndModuleAndTenant(roleId, moduleId, tenantId); 
    if (!permission) {
      throw new NotFoundException('Permiso no encontrado');
    }
    this.logger.debug("********************************************************")
    this.logger.debug(permission);
    this.logger.debug(permissionDto);
    const permissionUpdated = await this.roleModulePermissionRepository.updateRoleModulePermission(permission, permissionDto);
    this.logger.debug(permissionUpdated);
    //return RoleReadPermissionDto.transformToDto(permissionUpdated);
    return permissionUpdated;
  }

  /**
   * Delete a role module permission
   * @param roleId - The ID of the role
   * @param tenantId - The ID of the tenant
   * @param moduleId - The ID of the module
   * @returns The result of the deletion
   */ 
  async deletePermission(roleId: string,tenantId: string,moduleId: string): Promise<void> {
    const deleteResult = await this.roleModulePermissionRepository.deleteRoleModulePermission(roleId,moduleId,tenantId);
    if (deleteResult.affected === 0) {
      throw new NotFoundException('Permiso no encontrado');
    }
    return
  }

  /**
   * List all permissions by roleId and tenantId
   * @param roleId - The ID of the role
   * @param tenantId - The ID of the tenant
   * @returns The permissions found
   */ 
  async listPermissions(roleId: string,tenantId: string): Promise<RoleReadPermissionDto[]> {
    const permissions = await this.roleModulePermissionRepository.findByRoleAndTenant(roleId, tenantId);
    return permissions;
  }

}