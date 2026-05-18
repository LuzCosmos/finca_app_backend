import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScaleReadingResponseDto {
  @ApiProperty()
  deviceId: string;

  @ApiProperty()
  tenantId: string;

  @ApiPropertyOptional()
  rawFrame?: string | null;

  @ApiPropertyOptional()
  weight: number | null;

  @ApiPropertyOptional()
  unit: string | null;

  @ApiProperty()
  isStable: boolean;

  @ApiPropertyOptional()
  stabilityReason?: string | null;

  @ApiProperty()
  observedAt: string;

  @ApiProperty()
  sequence: number;
}
