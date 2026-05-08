import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ApplyProfileDto {
  @ApiProperty({
    description: 'UUID del perfil de configuración (system o tenant) a aplicar al device.',
    example: '7b3b7c4a-0e1d-4d56-9f0c-bf5b8b5b91a3',
  })
  @IsUUID('4')
  idProfile: string;
}
