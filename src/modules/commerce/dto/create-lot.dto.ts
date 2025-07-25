import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateLotDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lotNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  originPlace: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  cattleCount: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  totalWeight: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  pricePerKg: number;

  @ApiProperty()
  @IsNumber()
  totalValue: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  age: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sex: string;
}
