import { PartialType } from '@nestjs/mapped-types';
import { CreateCattleDto } from './create-cattle.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateCattleDto extends PartialType(CreateCattleDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'salePrice must be non-negative' })
  salePrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'saleWeight must be non-negative' })
  saleWeight?: number;
}  