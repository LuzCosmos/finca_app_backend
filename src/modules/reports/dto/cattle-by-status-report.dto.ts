import { ApiProperty } from '@nestjs/swagger';

export class CattleByStatusCountsDto {
  @ApiProperty({ example: 10 })
  ACTIVE: number;

  @ApiProperty({ example: 5 })
  SOLD: number;

  @ApiProperty({ example: 2 })
  DEAD: number;

  @ApiProperty({ example: 1 })
  LOST: number;
}

export class CattleByStatusReportDto {
  @ApiProperty({ example: 18 })
  totalCount: number;

  @ApiProperty({ type: CattleByStatusCountsDto })
  byStatus: CattleByStatusCountsDto;
}
