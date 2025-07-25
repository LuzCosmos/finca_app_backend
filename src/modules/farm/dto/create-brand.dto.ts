import { IsString } from 'class-validator';

export class CreateBrandDto {
  idTenant?: string;

  @IsString()
  name: string;
}