import { ApiProperty } from '@nestjs/swagger';

export class CattleOnFeedReportDto {
  @ApiProperty({ example: 3 })
  onFeedCount: number;

  @ApiProperty({ example: 10 })
  activeCount: number;

  @ApiProperty({ example: 5 })
  soldCount: number;

  @ApiProperty({ example: 15 })
  activeAndSoldTotal: number;
}
