import { IsOptional, IsString, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBusinessPartnerDto {
  @ApiPropertyOptional({ example: 'Ganadería El Porvenir', description: 'Business partner name' })
  @IsString()
  @IsOptional()
  @Length(3, 150)
  name?: string;

  @ApiPropertyOptional({ example: '900987654-1', description: 'NIT (if updatable)' })
  @IsString()
  @IsOptional()
  @Length(5, 20)
  nit?: string;
}
