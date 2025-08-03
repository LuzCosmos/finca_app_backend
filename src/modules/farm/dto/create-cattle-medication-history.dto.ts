import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateCattleMedicationHistoryDto {
  @IsUUID()
  idCattle: string;

  @IsUUID()
  medicationName: string;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  lot?: string;

  @IsOptional()
  @IsString()
  recordedBy?: string;

  @IsOptional()
  @IsString()
  recordedInMassiveEvent?: string;
}
