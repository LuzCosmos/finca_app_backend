import { IsArray, IsOptional, IsString, IsUUID, IsNumber, Min, IsDate, IsBoolean } from 'class-validator';

export class ReceiveCattleRequestDto {

  @IsString()
  number: string;

  @IsNumber()
  receivedWeight: number;

  @IsUUID()
  idPurchase: string;

  @IsNumber()
  purchaseWeight: number;

  @IsNumber()
  purchasePrice: number;

  @IsOptional()
  @IsUUID()
  idLot?: string;

  @IsOptional()
  @IsUUID()
  idBrand?: string;

  @IsOptional()
  @IsUUID()
  idColor?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  characteristicsIds?: string[];

  @IsOptional()
  @IsString()
  eartag?: string;

  @IsOptional()
  @IsUUID()
  idDevice?: string;

  @IsOptional()
  @IsBoolean()
  castrated: boolean;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  idSimpleEvents?: string[];
}
