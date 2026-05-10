import { Allow, IsString, IsNotEmpty, IsOptional, IsDate, IsDateString, IsNumber, IsPositive, MaxLength, MinLength, IsUUID, IsArray, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CattleGender } from '../enums/cattle-gender.enum';
import { CattleStatus } from '../entities/cattle.entity';
export class CreateCattleDto {

  /** Rellenado en servidor; @Allow evita que forbidNonWhitelisted falle tras plainToInstance. */
  @Allow()
  idTenant: string;

  @IsUUID()
  @IsOptional()
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
  @IsOptional()
  purchasedFrom?: string;

  @ApiProperty({ required: true })
  @IsNumber()
  purchasePrice: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  purchaseCommission?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
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
  eartagLeft?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  eartagRight?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  idLot?: string;

  @ApiProperty({ required: false, enum: CattleGender })
  @IsEnum(CattleGender)
  @IsOptional()
  gender?: CattleGender;

  @ApiProperty({ required: false, enum: CattleStatus })
  @IsEnum(CattleStatus)
  @IsOptional()
  status?: CattleStatus;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  birthDateAprx?: string;

  /** Dentición opcional — si se envían campos, deben enviarse todos para estimación (ver dominio). */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  milkTeethCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  permanentTeethCount?: number;

  @ApiProperty({ required: false, description: 'Desgaste leche 0–5' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  milkTeethWear?: number;

  @ApiProperty({ required: false, description: 'Desgaste permanentes 0–5' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  permanentTeethWear?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dentalEvaluationDate?: string;

  @ApiProperty({ required: false, description: 'Fecha en que la res inicia con la nueva alimentación' })
  @IsDateString()
  @IsOptional()
  newFeedStartDate?: string;

  @ApiProperty({ required: false, description: 'Ganancia diaria promedio (kg/día)' })
  @IsNumber()
  @IsOptional()
  averageDailyGain?: number;

  @ApiProperty({ required: true })
  @IsNumber()
  lastWeight?: number;
}