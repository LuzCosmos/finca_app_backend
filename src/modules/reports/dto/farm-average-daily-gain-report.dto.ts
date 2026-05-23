import { ApiProperty } from '@nestjs/swagger';

export class FarmAverageDailyGainReportDto {
  @ApiProperty({ example: 0.733, nullable: true })
  farmAverageDailyGainKg: number | null;

  @ApiProperty({ example: true })
  hasData: boolean;
}
