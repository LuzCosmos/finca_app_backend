import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SyncBrandDto {
  @ApiProperty({ example: 'uuid-local-brand' })
  id: string; // UUID generado offline

  @ApiProperty({ example: 'tenant-uuid' })
  idTenant: string;

  @ApiProperty({ example: 'Marca X' })
  name: string;

  @ApiPropertyOptional({ example: 'https://example.com/brand-image.png' })
  imageUrl?: string;
}

export class SyncBrandRequestDto {
  @ApiProperty({ type: [SyncBrandDto] })
  brands: SyncBrandDto[];
}

export class SyncBrandResultDto {
  @ApiProperty({ example: 'uuid-local-brand' })
  id: string;

  @ApiProperty({ example: 'synced' })
  status: string;

  @ApiProperty({ example: 'uuid-server-brand' })
  serverId?: string;

  @ApiProperty({ example: 'Optional error message', required: false })
  message?: string;
}

export class SyncBrandResponseDto {
  @ApiProperty({ type: [SyncBrandResultDto] })
  results: SyncBrandResultDto[];
}
