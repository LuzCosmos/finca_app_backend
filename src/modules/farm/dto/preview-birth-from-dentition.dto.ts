import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Max, Min } from 'class-validator';

/** Body para estimar fecha de nacimiento sin persistir (UI recepción / lista maestra). */
export class PreviewBirthFromDentitionDto {
  @ApiProperty({ minimum: 0, maximum: 8 })
  @IsInt()
  @Min(0)
  @Max(8)
  milkTeethCount: number;

  @ApiProperty({ minimum: 0, maximum: 8 })
  @IsInt()
  @Min(0)
  @Max(8)
  permanentTeethCount: number;

  @ApiProperty({ minimum: 0, maximum: 5 })
  @IsInt()
  @Min(0)
  @Max(5)
  milkTeethWear: number;

  @ApiProperty({ minimum: 0, maximum: 5 })
  @IsInt()
  @Min(0)
  @Max(5)
  permanentTeethWear: number;

  @ApiProperty({ description: 'Fecha de evaluación dental (ISO date)' })
  @IsDateString()
  dentalEvaluationDate: string;
}
