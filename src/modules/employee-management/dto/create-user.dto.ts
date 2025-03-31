import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsEmail, Length, IsArray } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'ID del tenant al que pertenece el usuario',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({
    description: 'Nombre de usuario',
    example: 'juan.perez',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  username: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'Contraseña123!',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 50)
  password: string;

  @ApiProperty({
    description: 'IDs de los roles asignados al usuario',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    required: true,
    isArray: true,
    type: [String],
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  roleIds: string[];

  @ApiProperty({
    description: 'Nombre del usuario',
    example: 'Juan',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  firstName: string;

  @ApiProperty({
    description: 'Apellido del usuario',
    example: 'Pérez',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  lastName: string;

  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'juan.perez@ejemplo.com',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  @Length(1, 150)
  email: string;
} 