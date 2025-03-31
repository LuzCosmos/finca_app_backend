import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { RequireAction } from '../../auth/decorators/require-action.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { User } from '../entities/user.entity';
import { RolesService } from '../services/roles.service';

@Controller('test-rbac')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class RbacTestController {
  constructor(private readonly rolesService: RolesService) {}
/*
  @Post('employee-management/test-create')
  @RequireModule('Employee Management')
  @RequireAction('create')
  async testCreatePermission(@GetUser() user: User) {
    return {
      message: 'Tienes permiso para crear en el módulo Employee Management',
      userId: user.id,
      username: user.username
    };
  }

  @Get('farm/test-read')
  @RequireModule('Farm')
  @RequireAction('read')
  async testReadPermission(@GetUser() user: User) {
    return {
      message: 'Tienes permiso para leer en el módulo Farm',
      userId: user.id,
      username: user.username
    };
  }

  @Get('my-accessible-modules')
  async getMyAccessibleModules(@GetUser() user: User) {
    const accessibleModules = await this.rolesService.getAccessibleModules(user);
    return {
      userId: user.id,
      username: user.username,
      accessibleModules: accessibleModules.map(module => ({
        id: module.id,
        name: module.name,
        description: module.description
      }))
    };
  }*/
}