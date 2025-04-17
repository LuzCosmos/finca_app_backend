import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject, IsDate } from 'class-validator';

export class CreateDeviceDto {

  @IsString()
  @IsOptional()
  idTenant:string;
  
  @ApiProperty({ description: 'ID del perfil de dispositivo' })
  @IsString()
  @IsNotEmpty()
  idDeviceProfile: string;

  @ApiProperty({ description: 'DevEUI del dispositivo' })
  @IsString()
  @IsNotEmpty()
  deveui: string;

  @ApiProperty({ description: 'Nombre del dispositivo' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Descripción del dispositivo' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Tags del dispositivo' })
  @IsObject()
  @IsOptional()
  tags?: Record<string, any>;

  @ApiProperty({ description: 'Variables del dispositivo' })
  @IsObject()
  @IsOptional()
  variables?: Record<string, any>;

  @IsDate()
  @IsOptional()
  createdAt?: Date;

  @IsDate()
  @IsOptional()
  updatedAt?: Date;
} 