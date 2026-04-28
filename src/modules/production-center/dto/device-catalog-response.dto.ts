import { ApiProperty } from '@nestjs/swagger';

/** Campos mínimos para cache offline en apps móviles (sin claves ni metadatos sensibles). */
export class DeviceCatalogResponseDto {
  @ApiProperty({ description: 'ID del dispositivo' })
  id: string;

  @ApiProperty({ description: 'DevEUI' })
  deveui: string;

  @ApiProperty({ description: 'Nombre' })
  name: string;
}
