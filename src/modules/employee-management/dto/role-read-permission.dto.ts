import { ApiProperty } from '@nestjs/swagger';
import { RoleModulePermission } from '../entities/role-module-permission.entity';
export class ModuleReadDto {
  @ApiProperty({
    description: 'ID del módulo',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  id: string;

  @ApiProperty({
    description: 'Código del módulo',
    example: 'EMP_MGMT'
  })
  code: string;

  @ApiProperty({
    description: 'Nombre del módulo',
    example: 'Gestión de Empleados'
  })
  name: string;

  @ApiProperty({
    description: 'Detalles de acceso adicionales del módulo',
    example: {
      customField: 'valor',
      settings: { enabled: true }
    }
  })
  access_details: any;
}

export class RoleReadPermissionDto {
  @ApiProperty({
    description: 'ID del permiso',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  id: string;

  @ApiProperty({
    description: 'Permiso para crear',
    example: true
  })
  can_create: boolean;

  @ApiProperty({
    description: 'Permiso para leer',
    example: true
  })
  can_read: boolean;

  @ApiProperty({
    description: 'Permiso para actualizar',
    example: true
  })
  can_update: boolean;

  @ApiProperty({
    description: 'Permiso para eliminar',
    example: false
  })
  can_delete: boolean;

  @ApiProperty({
    description: 'Permiso para listar',
    example: true
  })
  can_list: boolean;

  @ApiProperty({
    description: 'Información del módulo asociado',
    type: ModuleReadDto
  })
  module: ModuleReadDto;

  public static transformToDto(permission: RoleModulePermission): RoleReadPermissionDto {
    const roleReadPermissionDto = new RoleReadPermissionDto();
    roleReadPermissionDto.id = permission.id;
    roleReadPermissionDto.can_create = permission.can_create;
    roleReadPermissionDto.can_read = permission.can_read;
    roleReadPermissionDto.can_update = permission.can_update; 
    roleReadPermissionDto.can_delete = permission.can_delete;
    roleReadPermissionDto.can_list = permission.can_list;
    roleReadPermissionDto.module = permission.module;
    return roleReadPermissionDto;
  }

}