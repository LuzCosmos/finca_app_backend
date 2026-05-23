import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Encola **un solo** downlink Read con el bloque de IDs seguros indicado por `chunkIndex`
 * (0-based), tal como `readAllSafeParameters` los fragmenta internamente.
 */
export class ReadSafeParametersChunkDto {
  @ApiProperty({
    description:
      'Índice del bloque (0-based). Debe ser menor que el total de bloques devuelto por GET …/read-safe-parameters-chunks.',
    example: 0,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @Max(63)
  // En la implementación actual hay 11 bloques (índices 0..10). El upper bound generoso
  // se mantiene para no tener que tocar el DTO si se reordenan los presets.
  chunkIndex: number;
}
