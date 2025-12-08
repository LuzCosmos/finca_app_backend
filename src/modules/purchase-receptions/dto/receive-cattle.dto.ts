import { IsArray, IsOptional, IsString, IsUUID, IsNumber, Min } from 'class-validator';

export class ReceiveCattleDto {
  @IsString()
  number!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsUUID()
  lotId?: string | null;

  @IsOptional()
  @IsUUID()
  colorId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  characteristicsIds?: string[];

  @IsOptional()
  @IsString()
  eartag?: string | null;

  @IsOptional()
  @IsUUID()
  trackerId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  simpleEventIds?: string[];

  @IsOptional()
  @IsUUID()
  purchaseId?: string;
}
