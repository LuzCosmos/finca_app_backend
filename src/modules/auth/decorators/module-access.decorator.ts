import { SetMetadata } from '@nestjs/common';

export const RequireModule = (moduleName: string) => SetMetadata('module', moduleName);
export const RequireAction = (action: 'create' | 'read' | 'update' | 'delete') => SetMetadata('action', action); 