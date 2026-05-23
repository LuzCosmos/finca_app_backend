import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export class LocalStorageCommandDto {
  @ApiProperty({
    description:
      'Sub-comando de Local Storage Data Command (port 11): upload | clear | pause | resume.',
    example: 'upload',
    enum: ['upload', 'clear', 'pause', 'resume'],
  })
  @IsIn(['upload', 'clear', 'pause', 'resume'])
  action: 'upload' | 'clear' | 'pause' | 'resume';

  @ApiProperty({
    description:
      'Solo para action=upload. 1..65534 = últimos N días. 65535 = todo el almacenamiento.',
    example: 7,
    required: false,
  })
  @ValidateIf((o: LocalStorageCommandDto) => o.action === 'upload')
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  lastDays?: number;
}
