import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, Length } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({
    description: 'Nombre del tenant',
    example: 'Finca Los Alamos',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  name: string;

  @ApiProperty({
    description: 'Nombre de usuario de la compañía',
    example: 'finca_alamos',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  company_username: string;

  @ApiProperty({
    description: 'Estado del tenant',
    example: true,
    required: true,
    default: true,
  })
  @IsBoolean()
  status: boolean;
} 