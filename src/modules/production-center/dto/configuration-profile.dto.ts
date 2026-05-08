import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateConfigurationProfileDto {
  @ApiProperty({
    description:
      'Código único del perfil dentro del tenant. UPPER_SNAKE_CASE recomendado, p.ej. PRADERA_NORTE.',
    example: 'PRADERA_NORTE',
  })
  @IsString()
  @Length(2, 50)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code debe contener solo MAYÚSCULAS, dígitos, guión bajo o guión',
  })
  code: string;

  @ApiProperty({ description: 'Nombre legible.', example: 'Pradera norte (1h)' })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiPropertyOptional({ example: 'Configuración para los collares de la pradera norte.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Parámetros del perfil con sus valores ya validados. Solo claves NO peligrosas.',
    example: {
      workingMode: 'periodic',
      heartbeatInterval: 720,
      periodicReportInterval: 3600,
    },
  })
  @IsObject()
  parameters: Record<string, unknown>;
}

export class UpdateConfigurationProfileDto {
  @ApiPropertyOptional({ example: 'Pradera norte (cada 30 min)' })
  @IsString()
  @Length(2, 100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  parameters?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
