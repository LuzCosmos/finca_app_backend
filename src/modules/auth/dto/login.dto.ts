import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'usuario@ejemplo.com',
    description: 'El nombre de usuario o correo electrónico',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    example: 'contraseña123',
    description: 'La contraseña del usuario',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
} 