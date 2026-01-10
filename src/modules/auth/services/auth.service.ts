import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../employee-management/services/users.service';
import { User } from '../../employee-management/entities/user.entity';
import { ApplicationPermissionsService } from '../../../common/application-permissions/application-permissions.service';
import { RoleModulePermissionService } from '../../employee-management/services/role-module-permission.services';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private applicationPermissionsService: ApplicationPermissionsService,
    private roleModulePermissionsService: RoleModulePermissionService
  ) { }

  async validateUser(username: string, company_username: string, password: string): Promise<any> {
    const user = await this.usersService.findByUsernameAndPasswordAndCompanyUsername(username, password, company_username);
    this.logger.debug('User:', user);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }

  async login(user: User) {
    const roleIds = user.roles.map(role => role.id);
    const roleModulePermissions = await this.roleModulePermissionsService.getByRolesAndTenant(roleIds, user.tenantId);
    const permissions = this.applicationPermissionsService.getSimplefiedModulePermissionsByRolesAndModuleAndTenant(roleModulePermissions);
    this.logger.debug('Permissions:', permissions);
    const permissionsHash = this.applicationPermissionsService.computePermissionsHash(permissions);
    const sessionId = crypto.randomUUID();
    const sessionData = {
      username: user.username,
      sub: user.id,
      tenant_id: user.tenantId,
      date: new Date().toISOString(),
      permissionsHash: permissionsHash,
      permissions: permissions,
      sessionId: sessionId
    };
    // Store the session data in Redis with the permissions hash
    await this.applicationPermissionsService.saveSessionData(user.id, sessionId, sessionData);
    const payload = {
      username: user.username,
      sub: user.id,
      tenant_id: user.tenantId,
      permissionsHash: permissionsHash,
      sessionId: sessionId
    };
    const token = this.jwtService.sign(payload);
    this.logger.debug('Token:', token);
    return {
      access_token: token,
      user: {
        id: user.id,
        username: user.username,
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        tenant_id: user.tenantId,
        roles: user.roles
      },
      permissions: permissions
    };
  }
} 