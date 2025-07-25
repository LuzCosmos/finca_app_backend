import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SimpleEventInputDto {
  @ApiProperty({
    description: 'Tipo de evento simple',
    enum: ['weight', 'eartag', 'tracker', 'brand', 'castration', 'medication'],
    example: 'medication',
  })
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({
    description:
      'Datos específicos del evento simple (solo para brand o medication)',
    example: { medicationName: 'med123', dosage: '1ml/50kg', lot: '123' },
  })
  @IsOptional()
  data?: any;
}

export class CreateMassiveEventDto {
  @ApiProperty({
    description: 'Fecha del evento masivo',
    example: '2025-07-24',
  })
  @IsNotEmpty()
  @IsDateString()
  eventDate: string;

  @ApiPropertyOptional({
    description: 'Lista inicial de simpleEvents (puede ir vacía)',
    type: [SimpleEventInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimpleEventInputDto)
  simpleEvents?: SimpleEventInputDto[];
}
