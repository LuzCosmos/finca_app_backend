import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsNotEmpty, IsString } from 'class-validator';
import { CreateLotDto } from './create-lot.dto';

export class CreatePurchaseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idProvider: string;

  @ApiProperty()
  @IsDateString()
  purchaseDate: string;

  @ApiProperty({ type: [CreateLotDto] })
  @IsArray()
  lots: CreateLotDto[];
}
