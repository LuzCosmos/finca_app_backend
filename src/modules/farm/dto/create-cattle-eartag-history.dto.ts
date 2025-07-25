import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateCattleEartagHistoryDto {
  @IsUUID()
  idCattle: string;

  @IsString()
  eartagNumber: string;

  @IsOptional()
  @IsString()
  assignedBy?: string;

  @IsOptional()
  @IsString()
  recordedInMassiveEvent?: string;
}
