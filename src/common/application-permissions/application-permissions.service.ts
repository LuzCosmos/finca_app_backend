import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RedisService } from 'src/modules/auth/redis/redis.service';
import { RoleModulePermission } from 'src/modules/employee-management/entities/role-module-permission.entity';


@Injectable()
export class ApplicationPermissionsService {
  private readonly logger = new Logger(ApplicationPermissionsService.name);
  private static readonly DEFAULT_SESSION_TTL_SECONDS = 86400;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) { }

  private parseDurationToSeconds(raw: string | undefined): number | null {
    if (!raw) return null;
    const value = raw.trim().toLowerCase();
    const match = /^(\d+)\s*([smhd])?$/.exec(value);
    if (!match) return null;

    const amount = Number.parseInt(match[1], 10);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const unit = match[2] ?? 's';
    const unitSeconds: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return amount * unitSeconds[unit];
  }

  /**
   * Compute a SHA-256 hash based on the permissions object.
   * @param permissions - e.g. {"module_code1": {"user": "11111", "tenant": "11110", ...}, "module_code2": {"role":"01001", "tenant": "11110", ...}}
   * @returns the computed hash as a hexadecimal string.
   */
  computePermissionsHash(permissions: Record<string, Record<string, string>>): string {
    const permissionsString = JSON.stringify(permissions);
    return crypto.createHash('sha256').update(permissionsString).digest('hex');
  }

  /**
   * Stores the session data in Redis along with the computed permissions hash.
   * @param userId - Unique identifier of the user.
   * @param hash - Computed permissions hash.
   * @param sessionData - Essential session data to store.
   * @param sessionId - Unique identifier of the session.
   */
  async saveSessionData(userId: string, sessionId: string, sessionData: Record<string, any>): Promise<void> {
    const key = `session:${userId}:${sessionId}`;
    const configuredExpiration = this.configService.get<string>('JWT_EXPIRATION');
    const sessionTtlSeconds = this.parseDurationToSeconds(configuredExpiration);
    const ttlSeconds = sessionTtlSeconds ?? ApplicationPermissionsService.DEFAULT_SESSION_TTL_SECONDS;

    if (sessionTtlSeconds == null) {
      this.logger.warn(
        `Invalid JWT_EXPIRATION value "${configuredExpiration}". Falling back to ${ttlSeconds} seconds.`,
      );
    }

    await this.redisService.set(key, JSON.stringify(sessionData), ttlSeconds);
  }

  /**
   * Retrieves the session data stored in Redis for a given user.
   * @param userId - Unique identifier of the user.
   * @param sessionId - Unique identifier of the session.
   * @returns The session data object or null if not found.
   */
  async getSessionFromRedis(userId: string, sessionId?: string): Promise<any> {
    let sessionDataString: string | null = null;
    if (sessionId) {
      sessionDataString = await this.redisService.get(`session:${userId}:${sessionId}`);
    } else {
      // Fallback for backward compatibility or cases where sessionId might be missing (though it shouldn't be with new tokens)
      // This part might be tricky if we enforce sessionId. For now, let's just return null if no sessionId is provided but we expect one.
      // Or, better, if we want to support old sessions temporarily, we could check `session:${userId}`. 
      // But purely for the new feature:
      sessionDataString = await this.redisService.get(`session:${userId}`);
    }

    if (!sessionDataString) {
      this.logger.debug(`No session data found for user ${userId} and session ${sessionId}`);
      return null;
    }
    const sessionData = JSON.parse(sessionDataString);
    this.logger.debug(`Found session data for user ${userId}:`, sessionData);
    return sessionData;
  }

  async deleteUserSession(userId: string, sessionId?: string): Promise<void> {
    this.logger.debug(`Deleting session for user ${userId}`);
    if (sessionId) {
      await this.redisService.del(`session:${userId}:${sessionId}`);
    } else {
      await this.redisService.del(`session:${userId}`);
    }
  }

  /**
  * Validates if a user has permission to access a module.
  * 
  * @param module_code - The module code.
  * @param entity - The entity name. 
  * @param action - The action character. Create: 0, Read: 1, Update: 2, Delete: 3, List: 4
  * @param permissions - The module permissions.  e.g. {"module_code1": {"user": "11111", "tenant": "11110", ...}, "module_code2": {"role":"01001", "tenant": "11110", ...}}
  *  
  * @returns True if the user has permission, otherwise false.
  */
  async canAccessModuleEntity(module_code: string, entity: string, action: string, permissions: Record<string, Record<string, string>>): Promise<boolean> {
    this.logger.debug(`Checking permission for ${module_code} ${entity} ${action}`);
    if (permissions[module_code] == undefined) {
      return false;
    }
    if (permissions[module_code][entity] == undefined) {
      return false;
    }
    const entity_permission = permissions[module_code][entity];
    const actions = ['create', 'read', 'update', 'delete', 'list'];
    const actionIndex = actions.indexOf(action);
    const action_permission = entity_permission[actionIndex];
    this.logger.debug(`Action permission for ${module_code} ${entity} ${action}: ${action_permission}`);
    return action_permission == '1';
  }


  /**
   * 
   * @param roleModulePermissions - The role module permissions array (RoleModulePermission[]).
   * @returns {"module_code1": {"user": "11111", "tenant": "11110", ...}, "module_code2": {"role":"01001", "tenant": "11110", ...}}
   */
  getSimplefiedModulePermissionsByRolesAndModuleAndTenant(roleModulePermissions: RoleModulePermission[]): Record<string, Record<string, string>> {
    const permissions: Record<string, Record<string, string>> = {};
    if (!roleModulePermissions) {
      return permissions;
    }
    this.logger.debug(`Role module permissions: ${JSON.stringify(roleModulePermissions)}`);
    for (const permission of roleModulePermissions) {
      var role_permission = [
        permission.can_create,
        permission.can_read,
        permission.can_update,
        permission.can_delete,
        permission.can_list
      ].map(value => value ? '1' : '0').join('');;
      if (permissions[permission.module.code] == undefined) {
        permissions[permission.module.code] = {};
      }
      for (const entity in permission.module.access_details) {
        var entity_permission = "00000";
        if (Object.prototype.hasOwnProperty.call(permission.module.access_details, entity)) {
          entity_permission = permission.module.access_details[entity].replace(/[^0]/g, '1');
          entity_permission.split('').map((char, index) => (char === '1' && role_permission[index] === '1' ? '1' : '0')).join('');
        }
        const combined_entity_permission = entity_permission.split('').map((char, index) => (char === '1' && role_permission[index] === '1' ? '1' : '0')).join('');
        if (permissions[permission.module.code][entity] == undefined) {
          permissions[permission.module.code][entity] = combined_entity_permission;
        } else {
          const stored_entity_permission = permissions[permission.module.code][entity];
          permissions[permission.module.code][entity] = stored_entity_permission.split('')
            .map((char, index) => (char === '1' || combined_entity_permission[index] === '1' ? '1' : '0'))
            .join('');
        }
      }
    }
    return permissions;
  }
}