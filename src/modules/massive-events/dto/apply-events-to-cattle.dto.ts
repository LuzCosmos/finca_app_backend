import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SimpleEventType } from '../enums/simple-event-type.enum';

export class ApplySingleEventItemDto {
  @ApiProperty({ enum: SimpleEventType })
  @IsEnum(SimpleEventType)
  type: SimpleEventType;

  @ApiProperty({ description: 'Event-specific data' })
  @IsObject()
  data: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  appliedBy?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idSimpleEvent: string;
}

export class AppliedEventsToCattleDto {
  @ApiProperty({ example: 'N-100', description: 'Cattle business number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  cattleNumber: string;

  @ApiProperty({ example: 'uuid-massive-event-1' })
  @IsString()
  @IsNotEmpty()
  idMassiveEvent: string;

  @ApiProperty({ type: [ApplySingleEventItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplySingleEventItemDto)
  events: ApplySingleEventItemDto[];
}

export class ApplyEventsToCattleRequestDto {
  @ApiProperty({ type: AppliedEventsToCattleDto })
  @ValidateNested()
  @Type(() => AppliedEventsToCattleDto)
  applied: AppliedEventsToCattleDto;
}
