import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBrandDto {
  @ApiPropertyOptional({ example: 'uuid-frontend-brand' })
  @IsOptional()
  id?: string;

  @ApiProperty()
  idTenant?: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  imageUrl?: string;
}
