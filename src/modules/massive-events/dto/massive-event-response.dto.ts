import { ApiProperty } from '@nestjs/swagger';
import { MassiveEvent } from '../entities/massive-events.entity';
import { SimpleEvent } from '../entities/simple-event.entity';
import { SimpleEventResponseDto } from './simple-event-response.dto';

export class MassiveEventResponseDto {
  @ApiProperty({ example: 'uuid-massive-event', description: 'Unique ID of the massive event' })
  id: string;

  @ApiProperty({ example: 'uuid-tenant', description: 'Tenant identifier' })
  idTenant: string;

  @ApiProperty({ example: 'open', description: 'Status of the massive event' })
  status: string;
  
  @ApiProperty({ example: '2022-01-01', description: 'Event date' })
  eventDate: Date;

  @ApiProperty({ example: 'Vacunación marzo', required: false, description: 'Optional display name' })
  name?: string;

  @ApiProperty({ example: 'uuid-user', required: false, description: 'User who created the event' })
  createdBy?: string;

  @ApiProperty({
    example: 'jdoe',
    required: false,
    description: 'Username of the creator (same tenant); for display in lists',
  })
  createdByUsername?: string;

  @ApiProperty({
    example: false,
    description: 'True if linked to a purchase reception (not shown in standalone massive-events list)',
  })
  linkedToPurchaseReception: boolean;

  @ApiProperty({ example: '2025-07-24T12:00:00Z', description: 'Date when the massive event was created' })
  createdAt: Date;

  @ApiProperty({ example: '2025-07-24T12:00:00Z', description: 'Date when the massive event was last updated' })
  updatedAt: Date;

  @ApiProperty({
    type: [SimpleEventResponseDto],
    description: 'List of simple events associated with this massive event',
  })
  simpleEvents: SimpleEventResponseDto[];

  static toResponseDto(
    entity: MassiveEvent,
    simpleEvents?: SimpleEvent[],
    opts?: { createdByUsername?: string | null },
  ): MassiveEventResponseDto {
    const dto: MassiveEventResponseDto = {
      id: entity.id,
      idTenant: entity.idTenant,
      status: entity.status,
      eventDate: entity.eventDate,
      name: entity.name,
      createdBy: entity.createdBy,
      linkedToPurchaseReception: entity.linkedToPurchaseReception ?? false,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      simpleEvents: simpleEvents
        ? simpleEvents.map(SimpleEventResponseDto.toResponseDto)
        : [],
    };
    const un = opts?.createdByUsername?.trim();
    if (un) {
      dto.createdByUsername = un;
    }
    return dto;
  }
}
