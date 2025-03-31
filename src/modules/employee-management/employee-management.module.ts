import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantsController } from './controllers/tenants.controller';
import { RolesController } from './controllers/roles.controller';
import { UsersController } from './controllers/users.controller';
import { RbacTestController } from './controllers/rbac-test.controller';
import { TenantsService } from './services/tenants.service';
import { RolesService } from './services/roles.service';
import { UsersService } from './services/users.service';
import { ModulesService } from './services/modules.service';
import { Tenant } from './entities/tenant.entity';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { RoleModulePermission } from './entities/role-module-permission.entity';
import { ModuleEntity } from './entities/module.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      Role,
      User,
      RoleModulePermission,
      ModuleEntity
    ]),
  ],
  controllers: [
    TenantsController,
    RolesController,
    UsersController,
    RbacTestController
  ],
  providers: [
    TenantsService,
    RolesService,
    UsersService,
    ModulesService
  ],
  exports: [UsersService, RolesService, ModulesService]
})
export class EmployeeManagementModule {} 