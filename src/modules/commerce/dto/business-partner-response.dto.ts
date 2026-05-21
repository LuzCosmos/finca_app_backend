import { ApiProperty } from '@nestjs/swagger';
import { BusinessPartner, BusinessPartnerRole } from '../entities/business-partner.entity';

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

  public static toResponse(businessPartner: BusinessPartner): BusinessPartnerResponseDto {
    return {
      id: businessPartner.id,
      name: businessPartner.name,
      nit: businessPartner.nit,
      type: businessPartner.type,
      created_at: businessPartner.created_at,
      updated_at: businessPartner.updated_at,
    };
  }
}
