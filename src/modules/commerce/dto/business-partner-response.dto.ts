import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessPartner, BusinessPartnerRole } from '../entities/business-partner.entity';
import { BusinessPartnerExtraConfigRecord } from '../utils/business-partner-extra-config.util';

export class BusinessPartnerResponseDto {
  @ApiProperty({ example: 'c3d1e10b-feb3-48f9-a19c-6f95e7f416bc' })
  id: string;

  @ApiProperty({ example: 'Ganadería El Porvenir' })
  name: string;

  @ApiProperty({ example: '900123456-7' })
  nit: string;

  @ApiProperty({ example: 'BUYER', enum: BusinessPartnerRole })
  type: BusinessPartnerRole;

  @ApiProperty({ example: '2025-07-03T18:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2025-07-04T10:32:00.000Z' })
  updated_at: Date;

  @ApiPropertyOptional({
    example: { sales: { minWeightKg: 350 } },
    description: 'Optional commercial settings (e.g. default min weight for BUYER)',
  })
  extraConfig?: BusinessPartnerExtraConfigRecord | null;

  public static toResponse(businessPartner: BusinessPartner): BusinessPartnerResponseDto {
    return {
      id: businessPartner.id,
      name: businessPartner.name,
      nit: businessPartner.nit,
      type: businessPartner.type,
      created_at: businessPartner.created_at,
      updated_at: businessPartner.updated_at,
      extraConfig: (businessPartner.extraConfig as BusinessPartnerExtraConfigRecord | null) ?? null,
    };
  }
}
