import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsEmail, Length } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'ID del tenant al que pertenece el usuario',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsUUID()
  @IsNotEmpty()
  id_tenant: string;

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
    description: 'ID del rol asignado al usuario',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsUUID()
  @IsNotEmpty()
  id_role: string;

  @ApiProperty({
    description: 'Nombre del usuario',
    example: 'Juan',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  first_name: string;

  @ApiProperty({
    description: 'Apellido del usuario',
    example: 'Pérez',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  last_name: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'Contraseña123!',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 50)
  pass_word: string;

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