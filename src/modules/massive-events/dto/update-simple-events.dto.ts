import { IsObject, IsBoolean, IsOptional } from 'class-validator';

export class UpdateSimpleEventDto {
    @IsObject()
    @IsOptional()
    data?: Record<string, any>;

    @IsBoolean()
    isActive: boolean;
}