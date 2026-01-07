import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateColorDto {
    @IsString()
    @IsNotEmpty()
    name: string;
}

export class ColorResponseDto {
    id: string;
    name: string;
}

export class CreateCharacteristicDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    groupName?: string;
}

export class CharacteristicResponseDto {
    id: string;
    name: string;
    groupName?: string;
}