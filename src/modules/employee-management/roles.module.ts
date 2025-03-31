import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesController } from './controllers/roles.controller';
import { RolesService } from './services/roles.service';
import { Role } from './entities/role.entity';
import { RoleModulePermission } from './entities/role-module-permission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, RoleModulePermission]),
  ],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {} 