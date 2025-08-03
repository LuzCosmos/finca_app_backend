import { ApiProperty } from '@nestjs/swagger';
import { IsEnum,IsArray, ValidateNested, IsString, IsIn, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { SimpleEventType } from '../enums/simple-event-type.enum';

class SingleEventDto {
  @ApiProperty({ example: 'C-001', description: 'Cattle number to apply the event' })
  @IsString()
  cattleNumber: string;

  @ApiProperty({ enum: ['weight', 'eartag', 'tracker', 'brand', 'castration'], example: 'weight' })
  //@IsIn(['weight', 'eartag', 'tracker', 'brand', 'castration'])
  @IsEnum(SimpleEventType)
  type: SimpleEventType;

  @ApiProperty({ description: 'Event-specific data' })
  @IsObject()
  data: any;

  @ApiProperty({ required: false, description: 'Optional appliedBy user id' })
  @IsOptional()
  @IsString()
  appliedBy?: string;

  @ApiProperty({ required: false, description: 'Optional simple event id to link (recordedInMassiveEvent)' })
  @IsOptional()
  @IsString()
  recordedInMassiveEvent?: string;
}

export class ApplySimpleEventsDto {
  @ApiProperty({ type: [SingleEventDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SingleEventDto)
  events: SingleEventDto[];
}
