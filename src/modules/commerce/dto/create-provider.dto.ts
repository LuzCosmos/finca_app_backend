import { IsNotEmpty, IsString, Length, IsOptional, IsEmail, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProviderType } from '../entities/provider.entity';

export class CreateProviderDto {
  @ApiProperty({ example: 'Ganadería La Ponderosa', description: 'Provider name' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 150)
  name: string;

  @ApiProperty({ example: '900123456-7', description: 'NIT (unique)' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 20)
  nit: string;

  @ApiPropertyOptional({ example: 'BUYER', enum: ProviderType, description: 'Provider type' })
  @IsEnum(ProviderType)
  @IsOptional()
  type?: ProviderType;

  @ApiPropertyOptional({ example: 'Calle 123 #45-67', description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'Juan Pérez', description: 'Contact person name' })
  @IsString()
  @IsOptional()
  contactPersonName?: string;

  @ApiPropertyOptional({ example: '+57 300 1234567', description: 'Primary phone number' })
  @IsString()
  @IsOptional()
  phone1?: string;

  @ApiPropertyOptional({ example: '+57 311 7654321', description: 'Secondary phone number' })
  @IsString()
  @IsOptional()
  phone2?: string;

  @ApiPropertyOptional({ example: 'contact@ganaderia.com', description: 'Email address' })
  @IsEmail()
  @IsOptional()
  email?: string;
}
