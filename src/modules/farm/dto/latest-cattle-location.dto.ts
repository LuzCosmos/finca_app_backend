import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class LatestCattleLocationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;

  @ApiProperty({ name: 'id_tenant', format: 'uuid' })
  @IsUUID()
  id_tenant: string;

  @ApiProperty({ name: 'id_device', format: 'uuid' })
  @IsUUID()
  id_device: string;

  @ApiProperty({ name: 'id_cattle', format: 'uuid' })
  @IsUUID()
  id_cattle: string;

  @ApiProperty()
  @IsNumber()
  latitude: number;

  @ApiProperty()
  @IsNumber()
  longitude: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  altitude?: number | null;

  @ApiProperty({ description: 'Timestamp de lectura GPS (ISO-8601)' })
  @IsString()
  time: string;

  @ApiProperty({ description: 'Número de la res (tabla cattle.number)' })
  @IsString()
  cattle_number: string;
}

