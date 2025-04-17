import { ApiProperty } from '@nestjs/swagger';

export class DeviceResponseDto {
  @ApiProperty({ description: 'ID del dispositivo' })
  id: string;

  @ApiProperty({ description: 'ID del perfil de dispositivo' })
  idDeviceProfile: string;

  @ApiProperty({ description: 'DevEUI del dispositivo' })
  deveui: string;

  @ApiProperty({ description: 'Nombre del dispositivo' })
  name: string;

  @ApiProperty({ description: 'Descripción del dispositivo' })
  description: string;

  @ApiProperty({ description: 'Tags del dispositivo' })
  tags: Record<string, any>;

  @ApiProperty({ description: 'Variables del dispositivo' })
  variables: Record<string, any>;

  @ApiProperty({ description: 'Estado del dispositivo' })
  isActive: boolean;

  @ApiProperty({ description: 'Fecha de creación del dispositivo' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de actualización del dispositivo' })
  updatedAt: Date;
} 