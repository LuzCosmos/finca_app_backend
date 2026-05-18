import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class PostScaleReadingDto {
  @ApiPropertyOptional({
    description:
      'Obsoleto: el tenant lo define la sesión activa del usuario en frontend (POST .../session). El bridge no debe enviarlo.',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Logical scale device id from bridge' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Raw ASCII frame' })
  @IsOptional()
  @IsString()
  rawFrame?: string;

  @ApiPropertyOptional({ description: 'Parsed weight in kg or native unit' })
  @IsOptional()
  @IsNumber()
  weight?: number | null;

  @ApiPropertyOptional({ example: 'kg' })
  @IsOptional()
  @IsString()
  unit?: string | null;

  @ApiProperty()
  @IsBoolean()
  isStable: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stabilityReason?: string;

  @ApiProperty()
  @IsISO8601()
  observedAt: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  sequence: number;
}
