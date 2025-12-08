import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { RedisService } from 'src/modules/auth/redis/redis.service';
import { RoleModulePermission } from 'src/modules/employee-management/entities/role-module-permission.entity';


@Injectable()
export class ApplicationPermissionsService {
  private readonly logger = new Logger(ApplicationPermissionsService.name);
  
  constructor(private redisService: RedisService) {}

  /**
   * Compute a SHA-256 hash based on the permissions object.
   * @param permissions - e.g. {"module_code1": {"user": "11111", "tenant": "11110", ...}, "module_code2": {"role":"01001", "tenant": "11110", ...}}
   * @returns the computed hash as a hexadecimal string.
   */
  computePermissionsHash(permissions: Record<string, Record<string, string>>): string  {
    const permissionsString = JSON.stringify(permissions);
    return crypto.createHash('sha256').update(permissionsString).digest('hex');
  }

  /**
   * Stores the session data in Redis along with the computed permissions hash.
   * @param userId - Unique identifier of the user.
   * @param hash - Computed permissions hash.
   * @param sessionData - Essential session data to store.
   */
  async saveSessionData(userId: string,sessionData: Record<string, any>): Promise<void> {
    const key = `session:${userId}`;
    // Store the session data with a TTL of 24 hours (86400 seconds)
    await this.redisService.set(key, JSON.stringify(sessionData), 86400);
  }

  /**
   * Retrieves the session data stored in Redis for a given user.
   * @param userId - Unique identifier of the user.
   * @returns The session data object or null if not found.
   */
  async getSessionFromRedis(userId: string): Promise<any> {
    const sessionDataString = await this.redisService.get(`session:${userId}`);
    if (!sessionDataString) {
      this.logger.debug(`No session data found for user ${userId}`);
      return null;
    }
    const sessionData = JSON.parse(sessionDataString);
    this.logger.debug(`Found session data for user ${userId}:`, sessionData);
    return sessionData;
  }

  async deleteUserSession(userId: string): Promise<void> {
    this.logger.debug(`Deleting session for user ${userId}`);
    await this.redisService.del(`session:${userId}`);
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