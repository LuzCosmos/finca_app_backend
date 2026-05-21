import { IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BusinessPartnerExtraConfigDto } from './business-partner-extra-config.dto';

export class UpdateBusinessPartnerDto {
  @ApiPropertyOptional({ example: 'Ganadería El Porvenir', description: 'Business partner name' })
  @IsString()
  @IsOptional()
  @Length(3, 150)
  name?: string;

  @ApiPropertyOptional({ example: '900987654-1', description: 'NIT (if updatable)' })
  @IsString()
  @IsOptional()
  @Length(5, 20)
  nit?: string;

  @ApiPropertyOptional({
    description: 'Role-specific settings (sales.minWeightKg for BUYER)',
    example: { sales: { minWeightKg: 350 } },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessPartnerExtraConfigDto)
  extraConfig?: BusinessPartnerExtraConfigDto;
}
