import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';

export class BusinessPartnerSalesExtraConfigDto {
  @ApiPropertyOptional({ example: 350, description: 'Default minimum weight (kg) for sales with this buyer' })
  @IsNumber()
  @Min(0.01)
  @Max(99999.99)
  minWeightKg: number;
}

export class BusinessPartnerExtraConfigDto {
  @ApiPropertyOptional({ type: BusinessPartnerSalesExtraConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessPartnerSalesExtraConfigDto)
  sales?: BusinessPartnerSalesExtraConfigDto;
}
