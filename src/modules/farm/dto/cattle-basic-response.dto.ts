import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CattleBasicResponseDto {
  @ApiProperty({ description: 'Tenant ID' })
  idTenant: string;

  @ApiProperty({ description: 'Cattle ID' })
  id: string;

  @ApiProperty({ description: 'Cattle number' })
  number: string;

  @ApiProperty({ description: 'Cattle system number' })
  sysNumber: string;

  @ApiPropertyOptional({ description: 'Assigned device UUID', nullable: true })
  idDevice?: string | null;

  @ApiPropertyOptional({ description: 'Left eartag', nullable: true })
  eartagLeft?: string | null;

  @ApiPropertyOptional({ description: 'Right eartag', nullable: true })
  eartagRight?: string | null;

  @ApiProperty({ description: 'Castrated' })
  castrated: boolean;

  @ApiProperty({ description: 'Has horns' })
  hasHorns: boolean;

  @ApiProperty({ description: 'Color enum value' })
  color: string;

  @ApiProperty({ description: 'Last update timestamp (ISO-8601)' })
  updatedAt: string;
}