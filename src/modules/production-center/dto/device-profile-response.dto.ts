import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class DeviceProfileResponseDto {
  @Expose()
  @ApiProperty({ description: 'ID del perfil de dispositivo' })
  id: string;

  /*@Expose()
  @ApiProperty({ description: 'ID del tenant' })
  idTenant: string;*/

  @Expose()
  @ApiProperty({ description: 'Nombre del perfil de dispositivo' })
  name: string;

  @Expose()
  @ApiProperty({ description: 'ID del perfil en Chirpstack' })
  idChipstack: string;

  @Expose()
  @ApiProperty({ description: 'ID de la aplicación en Chirpstack' })
  csApplicationId: string;

  @Expose()
  @ApiProperty({ description: 'Join EUI en Chirpstack' })
  csJoineui: string;

  @Expose()
  @ApiProperty({ description: 'App Key en Chirpstack' })
  csAppKey: string;

  @Expose()
  @ApiProperty({ description: 'NWK Key en Chirpstack' })
  csNwkKey: string;

  @Expose()
  @ApiProperty({ description: 'FCC ID' })
  fccId: string;

  @Expose()
  @ApiProperty({ description: 'Regiones' })
  regions: string;

  @Expose()
  @ApiProperty({ description: 'Modelo' })
  model: string;

  @Expose()
  @ApiProperty({ description: 'Input' })
  input: string;

  @Expose()
  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ description: 'Fecha de actualización' })
  updatedAt: Date;
} 