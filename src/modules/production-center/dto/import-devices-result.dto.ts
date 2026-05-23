import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportDeviceRowIssueDto {
  @ApiProperty({ example: 'DEVEUI_INVALID_LENGTH' })
  reason: string;

  @ApiProperty({ example: 3 })
  row: number;

  @ApiPropertyOptional({ example: 'a1b2c3d4e5f60708' })
  deveui?: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4e5f60708' })
  detail?: string;
}

export class ImportDevicesResultDto {
  @ApiProperty({ example: 10 })
  totalRows: number;

  @ApiProperty({ example: 8 })
  created: number;

  @ApiProperty({ example: 2 })
  updated: number;

  @ApiProperty({ type: [String], example: ['a1b2c3d4e5f60708'] })
  duplicateDeveuisInFile: string[];

  @ApiProperty({ type: [ImportDeviceRowIssueDto] })
  warnings: ImportDeviceRowIssueDto[];

  @ApiProperty({ type: [ImportDeviceRowIssueDto] })
  errors: ImportDeviceRowIssueDto[];
}
