import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';
import { RequireModule, RequireAction } from '../../auth/decorators/module-access.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { RolesService } from '../services/roles.service';
import { ModuleEntity } from '../entities/module.entity';

@ApiTags('test-rbac')
@ApiBearerAuth('access-token')
@Controller('test-rbac')
@UseGuards(JwtAuthGuard)
export class TestRbacController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('employee-management/test-create')
  @UseGuards(ModuleAccessGuard)
  @RequireModule('Employee Management')
  @RequireAction('create')
  @ApiOperation({ summary: 'Probar permiso de creación en Employee Management' })
  @ApiResponse({ status: 200, description: 'Tienes permiso de creación' })
  @ApiResponse({ status: 403, description: 'No tienes permiso de creación' })
  async testCreatePermission(@CurrentUser() currentUser: User) {
    return { message: 'Tienes permiso de creación en Employee Management' };
  }

  @Get('farm/test-read')
  @UseGuards(ModuleAccessGuard)
  @RequireModule('Farm')
  @RequireAction('read')
  @ApiOperation({ summary: 'Probar permiso de lectura en Farm' })
  @ApiResponse({ status: 200, description: 'Tienes permiso de lectura' })
  @ApiResponse({ status: 403, description: 'No tienes permiso de lectura' })
  async testReadPermission(@CurrentUser() currentUser: User) {
    return { message: 'Tienes permiso de lectura en Farm' };
  }

  @Get('my-accessible-modules')
  @ApiOperation({ summary: 'Obtener módulos accesibles para el usuario actual' })
  @ApiResponse({ status: 200, description: 'Lista de módulos accesibles' })
  async getMyAccessibleModules(@CurrentUser() currentUser: User) {
    const accessibleModules: ModuleEntity[] = [];
    
    for (const role of currentUser.roles) {
      const modules = await this.rolesService.getAccessibleModules(currentUser);
      accessibleModules.push(...modules);
    }

    // Eliminar duplicados
    const uniqueModules = [...new Map(accessibleModules.map(m => [m.id, m])).values()];

    return {
      user: {
        id: currentUser.id,
        username: currentUser.username,
        roles: currentUser.roles.map(r => r.name)
      },
      accessibleModules: uniqueModules.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description
      }))
    };
  }
}