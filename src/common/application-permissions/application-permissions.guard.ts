import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApplicationPermissionsService } from './application-permissions.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class ApplicationPermissionsGuard implements CanActivate {
  private readonly logger = new Logger(ApplicationPermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    private applicationPermissionsService: ApplicationPermissionsService,
  ) { }

  /**
   * Check if the user has permissions to access the module, entity and action
   * @param context - The execution context
   * @returns True if the user has permissions, false otherwise
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tokenUser = request.user;
    this.logger.debug('User from request:', tokenUser);
    if (!tokenUser || !tokenUser.sub) {
      throw new UnauthorizedException('User not authenticated');
    }

    console.log('User from request:', tokenUser);
    console.log('request:', request);
    // Use decorators to get the module, entity and action
    let module = this.reflector.get<string>('requireModule', context.getHandler());
    if (!module) {
      module = this.reflector.get<string>('requireModule', context.getClass());
    }
    let entity = this.reflector.get<string>('requireEntity', context.getHandler());
    if (!entity) {
      entity = this.reflector.get<string>('requireEntity', context.getClass());
    }
    const action = this.reflector.get<string>('requireAction', context.getHandler());
    this.logger.debug('Permission check:', { module, entity, action });
    if (!module || !entity || !action) {
      throw new ForbiddenException('Not Authorized');
    }
    if (entity === 'roles' && (action === 'create' || action === 'update' || action === 'delete')) {
      throw new ForbiddenException('Not Authorized');
    }
    if (entity === 'modules' && (action === 'create' || action === 'update' || action === 'delete')) {
      throw new ForbiddenException('Not Authorized');
    }
    // Exception: Allow free creation of tenants (action 0)
    if (entity === 'tenants' && action === 'create') { return true; }
    // Exception: Not allowed to list tenants (action 4)
    if (entity === 'tenants' && action === 'list') { return false; }
    // Check if the user has permissions in Redis
    const redisSessionData = await this.applicationPermissionsService.getSessionFromRedis(tokenUser.sub);
    if (!redisSessionData) {
      throw new ForbiddenException('No permissions found');
    }
    if (redisSessionData.permissionsHash !== tokenUser.permissionsHash) {
      throw new ForbiddenException('Invalid permissions');
    }
    if (!redisSessionData.permissions) {
      throw new ForbiddenException('No permissions found');
    }
    // Check if the user has access to the module
    const hasAccess = await this.applicationPermissionsService.canAccessModuleEntity(module, entity, action, redisSessionData.permissions);
    if (!hasAccess) {
      // Caso especial: Usuario modificando sus propios datos
      if (entity === 'users' && action === 'update' && tokenUser.sub === request.params.id) {
        // Si no tiene permisos completos, verificar si está intentando modificar campos restringidos
        const restrictedFields = ['roleIds', 'tenantId', 'active'];
        const updateData = request.body;
        // Verificar si está intentando modificar campos restringidos
        const hasRestrictedFields = restrictedFields.some(field =>
          updateData.hasOwnProperty(field)
        );
        // Si no está intentando modificar campos restringidos, permitir la actualización
        if (!hasRestrictedFields) {
          return true;
        }
        // Si está intentando modificar campos restringidos, denegar la actualización
        throw new ForbiddenException('No tienes permisos para modificar estos campos: roleIds, tenantId, active');
      } else {
        throw new ForbiddenException(`Access denied this action`);
      }
    }
    return true;
  }
}