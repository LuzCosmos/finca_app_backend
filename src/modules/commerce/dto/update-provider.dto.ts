import { IsOptional, IsString, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProviderDto {
  @ApiPropertyOptional({ example: 'Ganadería El Porvenir', description: 'Provider name' })
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
