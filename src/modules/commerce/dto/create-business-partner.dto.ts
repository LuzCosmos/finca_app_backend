import { IsNotEmpty, IsString, Length, IsOptional, IsEmail, IsEnum, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BusinessPartnerRole } from '../entities/business-partner.entity';
import { BusinessPartnerExtraConfigDto } from './business-partner-extra-config.dto';

export class CreateBusinessPartnerDto {
  @ApiProperty({ example: 'Ganadería La Ponderosa', description: 'Business partner name' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 150)
  name: string;

  @ApiProperty({ example: '900123456-7', description: 'NIT (unique)' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 20)
  nit: string;

  @ApiPropertyOptional({ example: 'BUYER', enum: BusinessPartnerRole, description: 'Business partner role' })
  @IsEnum(BusinessPartnerRole)
  @IsNotEmpty()
  type: BusinessPartnerRole;

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

  @ApiPropertyOptional({
    description: 'Role-specific settings (sales.minWeightKg required for BUYER)',
    example: { sales: { minWeightKg: 350 } },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessPartnerExtraConfigDto)
  extraConfig?: BusinessPartnerExtraConfigDto;
}
