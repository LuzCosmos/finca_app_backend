import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Resumen de dispositivo para listados administrativos (sin claves LoRaWAN). */
export class DeviceListItemResponseDto {
  @ApiProperty({ description: 'ID del dispositivo' })
  id: string;

  @ApiProperty({ description: 'Nombre del dispositivo' })
  name: string;

  @ApiProperty({ description: 'DevEUI del dispositivo' })
  deveui: string;

  @ApiProperty({ description: 'Estado activo/inactivo' })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Estado de batería reportado' })
  batteryStatus?: string | null;

  @ApiPropertyOptional({ description: 'Última actualización de batería' })
  batteryUpdate?: Date | null;

  @ApiPropertyOptional({ description: 'Nombre del perfil de dispositivo' })
  deviceProfileName?: string | null;
}
