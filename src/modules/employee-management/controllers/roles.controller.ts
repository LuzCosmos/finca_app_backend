import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { RequireAction } from '../../auth/decorators/require-action.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { RolesService } from '../services/roles.service';
import { Role } from '../entities/role.entity';
import { RoleModulePermission } from '../entities/role-module-permission.entity';
import { User } from '../entities/user.entity';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

class UpdatePermissionDto {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule('Employee Management')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequireAction('read')
  @ApiOperation({ summary: 'Obtener todos los roles' })
  async findAll(): Promise<Role[]> {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @RequireAction('read')
  @ApiOperation({ summary: 'Obtener un rol por ID' })
  async findOne(@Param('id') id: string): Promise<Role> {
    return this.rolesService.findOne(id);
  }

  @Post(':roleId/modules/:moduleId/permissions')
  @RequireAction('create')
  @ApiOperation({ summary: 'Crear permisos para un módulo específico' })
  async createPermission(
    @GetUser() user: User,
    @Param('roleId') roleId: string,
    @Param('moduleId') moduleId: string,
    @Body() permissions: UpdatePermissionDto
  ): Promise<RoleModulePermission> {
    return this.rolesService.createPermission(
      roleId,
      user.tenant.id,
      moduleId,
      permissions
    );
  }

  @Put(':roleId/modules/:moduleId/permissions')
  @RequireAction('update')
  @ApiOperation({ summary: 'Actualizar permisos para un módulo específico' })
  async updatePermission(
    @GetUser() user: User,
    @Param('roleId') roleId: string,
    @Param('moduleId') moduleId: string,
    @Body() permissions: UpdatePermissionDto
  ): Promise<RoleModulePermission> {
    return this.rolesService.updatePermission(
      roleId,
      user.tenant.id,
      moduleId,
      permissions
    );
  }

  @Delete(':roleId/modules/:moduleId/permissions')
  @RequireAction('delete')
  @ApiOperation({ summary: 'Eliminar permisos para un módulo específico' })
  async deletePermission(
    @GetUser() user: User,
    @Param('roleId') roleId: string,
    @Param('moduleId') moduleId: string
  ): Promise<void> {
    return this.rolesService.deletePermission(
      roleId,
      user.tenant.id,
      moduleId
    );
  }

  @Get(':roleId/permissions')
  @RequireAction('read')
  @ApiOperation({ summary: 'Listar todos los permisos de un rol' })
  async listPermissions(
    @GetUser() user: User,
    @Param('roleId') roleId: string
  ): Promise<RoleModulePermission[]> {
    return this.rolesService.listPermissions(roleId, user.tenant.id);
  }
} 