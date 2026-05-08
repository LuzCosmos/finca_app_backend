import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class ConfigureParametersDto {
  @ApiProperty({
    description:
      'Objeto plano con parámetros (camelCase) y sus valores. Solo se aceptan parámetros NO peligrosos. Los rangos válidos están en el codec.',
    example: {
      workingMode: 'periodic',
      heartbeatInterval: 720,
      periodicReportInterval: 3600,
      tamperAlarmSwitch: true,
    },
  })
  @IsObject()
  parameters: Record<string, unknown>;
}
