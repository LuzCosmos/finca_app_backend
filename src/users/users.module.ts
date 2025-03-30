import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantsController } from './controllers/tenants.controller';
import { RolesController } from './controllers/roles.controller';
import { UsersController } from './controllers/users.controller';
import { TenantsService } from './services/tenants.service';
import { RolesService } from './services/roles.service';
import { UsersService } from './services/users.service';
import { Tenant } from './entities/tenant.entity';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Role, User])
  ],
  controllers: [TenantsController, RolesController, UsersController],
  providers: [TenantsService, RolesService, UsersService],
  exports: [UsersService],
})
export class UsersModule {} 