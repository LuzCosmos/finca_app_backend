import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSimpleEventDto {
  @ApiProperty({
    description: 'ID del evento masivo al que pertenece este simpleEvent',
    example: 'uuid-massive-event-123',
  })
  @IsNotEmpty()
  idMassiveEvent: string;

  @ApiProperty({
    description: 'Tipo de evento simple',
    enum: ['weight', 'eartag', 'tracker', 'brand', 'castration', 'medication'],
    example: 'medication',
  })
  @IsNotEmpty()
  @IsEnum(['weight', 'eartag', 'tracker', 'brand', 'castration', 'medication'])
  type: string;

  @ApiPropertyOptional({
    description:
      'Datos específicos del evento simple. Solo aplica para brand o medication. Ejemplo: { idBrand: "abc123" } o { medicationName: "med123", dosage: "1ml/50kg", lot: "123" }',
    example: {  medicationName: 'med123', dosage: '1ml/50kg', lot: '123' },
  })
  @IsOptional()
  data?: any;
}
