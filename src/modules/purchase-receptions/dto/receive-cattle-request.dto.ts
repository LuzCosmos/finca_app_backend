import { IsArray, IsOptional, IsString, IsUUID, IsNumber, IsDateString, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class ReceiveCattleRequestDto {
  @IsUUID()
  idPurchase: string;

  @IsString()
  number: string;

  @IsNumber()
  receivedWeight: number;

  @IsOptional()
  @IsNumber()
  purchaseWeight?: number;

  @IsOptional()
  @IsNumber()
  purchasePrice?: number;

  @IsOptional()
  @IsBoolean()
  hasHorn: boolean;

  @IsOptional()
  @IsBoolean()
  castrated: boolean;

  @IsOptional()
  @IsUUID()
  idLot?: string;

  @IsOptional()
  @IsUUID()
  idBrand?: string;

  @IsString()
  color: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  characteristics?: string[];

  @IsOptional()
  @IsString()
  eartagLeft?: string;

  @IsOptional()
  @IsString()
  eartagRight?: string;

  @IsOptional()
  @IsUUID()
  idDevice?: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsUUID()
  idProvider?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  idSimpleEvents?: string[];

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsDateString()
  birthDateAprx?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  milkTeethCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  permanentTeethCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  milkTeethWear?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  permanentTeethWear?: number;

  @IsOptional()
  @IsDateString()
  dentalEvaluationDate?: string;
}

export class UpdateLotCattleRequestDto {
  @IsUUID()
  idLot: string;

  @IsUUID()
  idCattle: string;

}

