import { PartialType } from '@nestjs/mapped-types';
import { CreateCattleDto } from './create-cattle.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateCattleDto extends PartialType(CreateCattleDto) {
  
}  