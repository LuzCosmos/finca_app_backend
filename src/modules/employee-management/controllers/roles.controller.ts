import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';
import { RequireModule, RequireAction } from '../../auth/decorators/module-access.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RolesService } from '../services/roles.service';
import { Role } from '../entities/role.entity';
import { RoleModulePermission } from '../entities/role-module-permission.entity';
import { User } from '../entities/user.entity';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

class UpdatePermissionDto {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Controller('roles')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule('Employee Management')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequireAction('read')
  @ApiOperation({ summary: 'Obtener todos los roles' })
  @ApiResponse({
    status: 200,
    description: 'Lista de roles obtenida exitosamente',
    type: [Role]
  })
  @ApiResponse({ status: 403, description: 'No tienes permisos para ver roles' })
  async findAll(@CurrentUser() currentUser: User) {
    return this.rolesService.findAll(currentUser);
  }

  @Get(':id')
  @RequireAction('read')
  @ApiOperation({ summary: 'Obtener un rol por ID' })
  @ApiResponse({
    status: 200,
    description: 'Rol encontrado exitosamente',
    type: Role
  })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post(':roleId/permissions')
  @RequireAction('create')
  @ApiOperation({ summary: 'Crear permiso para un rol' })
  @ApiResponse({
    status: 201,
    description: 'Permiso creado exitosamente',
    type: RoleModulePermission
  })
  createPermission(
    @CurrentUser() currentUser: User,
    @Param('roleId') roleId: string,
    @Body() createPermissionDto: any
  ) {
    return this.rolesService.createPermission(
      roleId,
      currentUser.tenantId,
      createPermissionDto.moduleId,
      createPermissionDto
    );
  }

  @Put(':roleId/permissions/:moduleId')
  @RequireAction('update')
  @ApiOperation({ summary: 'Actualizar permiso de un rol' })
  @ApiResponse({
    status: 200,
    description: 'Permiso actualizado exitosamente',
    type: RoleModulePermission
  })
  updatePermission(
    @CurrentUser() currentUser: User,
    @Param('roleId') roleId: string,
    @Param('moduleId') moduleId: string,
    @Body() updatePermissionDto: any
  ) {
    return this.rolesService.updatePermission(
      roleId,
      currentUser.tenantId,
      moduleId,
      updatePermissionDto
    );
  }

  @Delete(':roleId/permissions/:moduleId')
  @RequireAction('delete')
  @ApiOperation({ summary: 'Eliminar permiso de un rol' })
  @ApiResponse({ status: 200, description: 'Permiso eliminado exitosamente' })
  removePermission(
    @CurrentUser() currentUser: User,
    @Param('roleId') roleId: string,
    @Param('moduleId') moduleId: string
  ) {
    return this.rolesService.deletePermission(
      roleId,
      currentUser.tenantId,
      moduleId
    );
  }

  @Get(':roleId/permissions')
  @RequireAction('read')
  @ApiOperation({ summary: 'Listar permisos de un rol' })
  @ApiResponse({
    status: 200,
    description: 'Lista de permisos obtenida exitosamente',
    type: [RoleModulePermission]
  })
  listPermissions(
    @CurrentUser() currentUser: User,
    @Param('roleId') roleId: string
  ) {
    return this.rolesService.listPermissions(roleId, currentUser.tenantId);
  }
} 