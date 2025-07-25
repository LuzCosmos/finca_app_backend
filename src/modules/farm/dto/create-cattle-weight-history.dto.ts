import { IsString, IsOptional, IsUUID, IsNumber } from 'class-validator';

export class CreateCattleWeightHistoryDto {
  @IsUUID()
  idCattle: string;

  @IsNumber()
  weight: number;

  @IsOptional()
  @IsString()
  recordedBy?: string;

  @IsOptional()
  @IsString()
  recordedInMassiveEvent?: string;

  @IsOptional()
  date?: Date;
}
