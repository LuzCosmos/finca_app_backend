import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SimpleEventType } from '../enums/simple-event-type.enum';

export class SyncSimpleEventDto {
  @ApiProperty({ example: 'uuid-local-simple-event' })
  id: string; // UUID generado en frontend

  @ApiProperty({ example: 'tenant-uuid' })
  idTenant: string;

  @ApiProperty({ example: 'uuid-existing-massive-event' })
  massiveEventServerId: string; // ya existe en backend

  @ApiProperty({ example: 'medication' })
  @IsEnum(SimpleEventType)
  type: SimpleEventType;

  @ApiProperty({ example: '{"medicationName":"m1","dosage":10,"lot":"123"}', required: false })
  dataJson?: string;

  @ApiProperty({ example: true, required: false })
  isActive?: boolean;

  @ApiProperty({ example: '2025-07-24T12:00:00Z', required: false })
  createdAt?: string;

  @ApiProperty({ example: 'user-123', required: false })
  createdBy?: string;
}

export class SyncSimpleEventsRequestDto {
  @ApiProperty({ type: [SyncSimpleEventDto] })
  simpleEvents: SyncSimpleEventDto[];
}

export class SyncSimpleEventResultDto {
  @ApiProperty({ example: 'uuid-local-simple-event' })
  id: string; // el mismo id que envió el front

  @ApiProperty({ example: 'synced' })
  status: string;

  @ApiProperty({ example: 'uuid-simple-event-backend' })
  serverId: string;

  @ApiProperty({ example: 'Optional message', required: false })
  message?: string;
}

export class SyncSimpleEventsResponseDto {
  @ApiProperty({ type: [SyncSimpleEventResultDto] })
  results: SyncSimpleEventResultDto[];
}
