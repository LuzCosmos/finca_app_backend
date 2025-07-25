import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsIn, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class SingleEventDto {
  @ApiProperty({ example: 'C-001', description: 'Cattle number to apply the event' })
  @IsString()
  cattleNumber: string;

  @ApiProperty({ enum: ['weight', 'eartag', 'tracker', 'brand', 'castration'], example: 'weight' })
  @IsIn(['weight', 'eartag', 'tracker', 'brand', 'castration'])
  type: 'weight' | 'eartag' | 'tracker' | 'brand' | 'castration';

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
