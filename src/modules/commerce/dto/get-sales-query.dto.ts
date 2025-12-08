import { IsOptional, IsInt, Min, IsString, IsEnum, IsDateString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SaleSortField {
    TRANSACTION_DATE = 'transactionDate',
    TOTAL_AMOUNT = 'totalAmount',
    BUYER = 'buyer',
    CREATED_AT = 'createdAt',
}

export enum SortOrder {
    ASC = 'ASC',
    DESC = 'DESC',
}

export class GetSalesQueryDto {
    @ApiPropertyOptional({ minimum: 0, default: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    skip?: number = 0;

    @ApiPropertyOptional({ minimum: 1, default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    take?: number = 10;

    @ApiPropertyOptional({ enum: SaleSortField, default: SaleSortField.TRANSACTION_DATE })
    @IsOptional()
    @IsEnum(SaleSortField)
    orderBy?: SaleSortField = SaleSortField.TRANSACTION_DATE;

    @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
    @IsOptional()
    @IsEnum(SortOrder)
    order?: SortOrder = SortOrder.DESC;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    buyerId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    status?: string; // Optional filtering by status if needed
}
