import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { SimpleEventType } from '../enums/simple-event-type.enum';

import {registerDecorator, ValidationOptions,ValidationArguments} from 'class-validator';

export function ValidateDataFields(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'ValidateDataFields',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(data: any, args: ValidationArguments) {
          const obj = args.object as any;
          const type = obj.type;
          if (type !== 'medication' && type !== 'brand') return true;

          if (typeof data !== 'object' || data === null) return false;

          if (type === 'medication') {
            const requiredKeys = ['medicationName', 'dosage', 'lot'];
            // Check keys presence
            const dataKeys = Object.keys(data);
            const hasAllKeys = requiredKeys.every((k) => dataKeys.includes(k));
            if (!hasAllKeys) return false;
            // Check non-empty string values
            return requiredKeys.every(
              (key) =>
                typeof data[key] === 'string' && data[key].trim().length > 0
            );
          }
          return true;
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as any;
          if (obj.type === 'medication') {
            return `Para type "medication", 'data' debe incluir 'medicationName', 'dosage' y 'lot', y todos deben ser strings no vacíos`;
          }
          return `Los campos en 'data' no pueden estar vacíos para el tipo ${obj.type}`;
        },
      },
    });
  };
}

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
  @IsEnum(SimpleEventType)
  type: SimpleEventType;

  @ApiPropertyOptional({
    description:
      'Datos específicos del evento simple. Solo aplica para brand o medication. Ejemplo: { idBrand: "abc123" } o { medicationName: "med123", dosage: "1ml/50kg", lot: "123" }',
    example: {  medicationName: 'med123', dosage: '1ml/50kg', lot: '123' },
  })
  @IsOptional()
  @ValidateDataFields()
  data?: any;
}

