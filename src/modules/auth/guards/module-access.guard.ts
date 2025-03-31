import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';
import { REQUIRE_ACTION_KEY } from '../decorators/require-action.decorator';
import { ModuleAction } from '../types/module-action.type';
import { ModulesService } from '../../employee-management/services/modules.service';
import { RolesService } from '../../employee-management/services/roles.service';

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private modulesService: ModulesService,
    private rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModuleName = this.reflector.get<string>(
      REQUIRE_MODULE_KEY,
      context.getHandler(),
    );

    const requiredAction = this.reflector.get<ModuleAction>(
      REQUIRE_ACTION_KEY,
      context.getHandler(),
    );

    if (!requiredModuleName || !requiredAction) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    try {
      // Obtener el módulo de la base de datos por nombre
      const module = await this.modulesService.findByName(requiredModuleName);
      
      // Verificar si el usuario tiene permiso para la acción en el módulo
      return await this.rolesService.hasPermission(
        user,
        module.id,
        requiredAction
      );
    } catch (error) {
      return false;
    }
  }
} 