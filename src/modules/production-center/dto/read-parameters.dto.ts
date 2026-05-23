import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReadParametersDto {
  @ApiProperty({
    description: 'Lista de nombres de parámetros (camelCase) a leer del device.',
    example: ['workingMode', 'heartbeatInterval', 'periodicReportInterval'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @IsString({ each: true })
  parameterNames: string[];
}
