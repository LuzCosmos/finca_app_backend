import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { SimpleEventType } from '../enums/simple-event-type.enum';

export class SyncSimpleEventInputDto {
  @ApiProperty({
    description: 'UUID of simpleEvent (generated in frontend)',
    example: 'uuid-simple-event-123',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Simple event type',
    enum: ['weight', 'eartag', 'tracker', 'brand', 'castration', 'medication'],
    example: 'medication',
  })
  @IsEnum(SimpleEventType)
  type: SimpleEventType;

  @ApiPropertyOptional({
    description: 'Specific data of simple event (JSON)',
    example: '{"medicationName":"m1","dosage":"1ml","route":"oral","lot":"123"}',
  })
  @IsOptional()
  @IsString()
  dataJson?: string;

  @ApiPropertyOptional({
    description: 'Creation date',
    example: '2025-07-24T10:00:00Z',
  })
  @IsOptional()
  @IsString()
  createdAt?: string;

  @ApiPropertyOptional({
    description: 'Whether the simple event is active for new cattle applications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SyncMassiveEventDto {
  @ApiProperty({
    description: 'UUID of massiveEvent (generated in frontend)',
    example: 'uuid-massive-event-123',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'UUID of tenant',
    example: 'tenant-uuid',
  })
  @IsString()
  @IsNotEmpty()
  idTenant: string;

  @ApiProperty({
    description: 'Event date',
    example: '2025-07-24T00:00:00Z',
  })
  @IsString()
  @IsNotEmpty()
  eventDate: string;

  @ApiProperty({
    description: 'Status',
    example: 'open',
  })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiPropertyOptional({
    description: 'Creator user',
    example: 'user-uuid-123',
  })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({
    description: 'Creation date',
    example: '2025-07-24T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  createdAt?: string;

  @ApiPropertyOptional({
    description: 'Update date',
    example: '2025-07-24T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  updatedAt?: string;

  @ApiPropertyOptional({
    description: 'Optional display name for the massive event',
    example: 'Vacunación marzo',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'List of simpleEvents to synchronize',
    type: [SyncSimpleEventInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncSimpleEventInputDto)
  simpleEvents?: SyncSimpleEventInputDto[];
}

export class SyncMassiveEventsRequestDto {
  @ApiProperty({ type: [SyncMassiveEventDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncMassiveEventDto)
  massiveEvents: SyncMassiveEventDto[];
}

export class SyncMassiveEventResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'synced' })
  status: string;

  @ApiPropertyOptional({ example: 'Additional message if applies' })
  message?: string;
}

export class SyncMassiveEventsResponseDto {
  @ApiProperty({ type: [SyncMassiveEventResultDto] })
  results: SyncMassiveEventResultDto[];
}
