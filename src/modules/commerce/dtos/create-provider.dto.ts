import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProviderDto {
  @ApiProperty({ example: 'Ganadería La Ponderosa', description: 'Provider name' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 150)
  name: string;

  @ApiProperty({ example: '900123456-7', description: 'NIT (unique)' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 20)
  nit: string;
}
