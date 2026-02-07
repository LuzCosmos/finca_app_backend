import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateCattleMedicationHistoryDto {
  @IsString()
  medicationName: string;

  @IsString()
  dosage: string;

  @IsString()
  route: string;

  @IsOptional()
  @IsString()
  lot?: string;

  @IsString()
  appliedAt: string;

  @IsOptional()
  @IsString()
  idMassiveEvent?: string;
}
