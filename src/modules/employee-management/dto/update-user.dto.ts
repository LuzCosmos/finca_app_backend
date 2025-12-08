import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsArray, IsUUID, IsBoolean } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({ required: false, description: 'Nombre de usuario' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ required: false, description: 'Contraseña del usuario' })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({ required: false, description: 'Nombre del usuario' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ required: false, description: 'Apellido del usuario' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ required: false, description: 'Correo electrónico del usuario' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false, description: 'Usuario Activo o Inactivo' })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiProperty({ required: false, description: 'IDs de los roles asignados al usuario', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  roleIds?: string[];
} 