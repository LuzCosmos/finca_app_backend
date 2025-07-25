import { ApiProperty } from '@nestjs/swagger';
import { Brand } from '../entities/brand.entity';

export class BrandResponseDto {
  @ApiProperty({ example: 'uuid-de-la-marca', description: 'Unique ID of the brand' })
  id: string;

  @ApiProperty({ example: 'Marca A', description: 'Name of the brand' })
  name: string;

  /*@ApiProperty({ example: 'tenant-uuid', description: 'Tenant identifier' })
  idTenant: string;*/

  @ApiProperty({ example: '2025-07-24T12:00:00Z', description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ example: '2025-07-24T12:00:00Z', description: 'Last update date' })
  updatedAt: Date;

  static toResponseDto(brand: Brand): BrandResponseDto {
    return {
      id: brand.id,
      name: brand.name,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  }
}

