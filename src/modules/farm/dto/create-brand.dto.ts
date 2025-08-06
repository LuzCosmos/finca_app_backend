import { IsOptional, IsString,IsNotEmpty,IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBrandDto {

  @ApiProperty()
  @IsOptional()
  @IsString()
  id?: string;
  
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ type: 'string', format: 'binary', required: true })
  @IsOptional()
  image?: any;

}
