import { IsOptional, IsUUID, IsObject, IsString } from 'class-validator';

export class CreateCattleEartagHistoryDto {
  @IsUUID()
  idCattle: string;

  @IsObject()
  data: Record<string, any>;

  @IsOptional()
  @IsString()
  assignedBy?: string;

  @IsOptional()
  @IsString()
  idMassiveEvent?: string;
}
