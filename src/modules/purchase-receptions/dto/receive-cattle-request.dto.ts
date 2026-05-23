import { IsArray, IsOptional, IsString, IsUUID, IsNumber, IsDateString, IsBoolean, IsInt, Min, Max, ValidateIf } from 'class-validator';

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

/** Campos editables de una res ya recibida (mismos que alta, excepto `number` e `idSimpleEvents`). */
export class UpdateReceivedCattleDto {
  @IsOptional()
  @IsNumber()
  receivedWeight?: number;

  @IsOptional()
  @IsString()
  eartagLeft?: string;

  @IsOptional()
  @IsString()
  eartagRight?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  idLot?: string | null;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  characteristics?: string[];

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsBoolean()
  hasHorn?: boolean;

  @IsOptional()
  @IsBoolean()
  castrated?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  idDevice?: string | null;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  birthDateAprx?: string | null;

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

