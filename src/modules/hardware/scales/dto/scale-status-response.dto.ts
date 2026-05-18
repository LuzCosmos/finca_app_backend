import { ApiProperty } from '@nestjs/swagger';

export type ScaleConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export class ScaleStatusResponseDto {
  @ApiProperty()
  scaleId: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty({ enum: ['connected', 'disconnected', 'reconnecting', 'error'] })
  status: ScaleConnectionStatus;

  @ApiProperty()
  updatedAt: string;
}
