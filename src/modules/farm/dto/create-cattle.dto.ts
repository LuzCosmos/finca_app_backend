import { IsString, IsNotEmpty, IsOptional, IsDate, IsDateString, IsNumber, IsPositive, MaxLength, MinLength, IsUUID, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CreateCattleDto {

  idTenant: string;

  @IsUUID()
  idDevice?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  deveui?: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  sysNumber: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  number: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  brand?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(25)
  @IsOptional()
  colorMain?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  colorDescription: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  colorFeature?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  lot?: string;

  @ApiProperty({ required: true })
  @IsDateString()
  receivedAt: string;

  @ApiProperty({ required: true })
  @IsNumber()
  receivedWeight: number;

  @ApiProperty({ required: true })
  @IsNumber()
  purchaseWeight: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  comments?: string;

  @ApiProperty({ required: false })
  @IsString()
  purchasedFrom?: string;

  @ApiProperty({ required: true })
  @IsNumber()
  purchasePrice: number;

  @ApiProperty({ required: false })
  @IsNumber()
  purchaseCommission?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  negotiatedPricePerKg?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  lotPricePerWeight?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  salePrice?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  salePricePerKg?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  saleWeight?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  averageGr?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  characteristics?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  hasHorn?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  castrated?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  eartag?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  auctionLot?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  idLot?: string;
}