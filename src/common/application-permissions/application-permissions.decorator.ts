import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to require a module
 * @param moduleName - The name of the module
 * @returns The decorator
 */
export const RequireModule = (moduleName: string) => SetMetadata('requireModule', moduleName);

/**
 * Decorator to require an entity
 * @param entityName - The name of the entity
 * @returns The decorator
 */ 
export const RequireEntity = (entityName: string) => SetMetadata('requireEntity', entityName);

/**
 * Decorator to require an action
 * @param actionName - The name of the action
 * @returns The decorator
 */ 
export const RequireAction = (actionName: 'create' | 'read' | 'update' | 'delete' | 'list') => SetMetadata('requireAction', actionName); 
