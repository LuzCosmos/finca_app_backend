import { ApiProperty } from '@nestjs/swagger';
import { LotResponseDto } from './lot-response.dto';
import { Purchase } from '../entities/purchase.entity';

export class PurchaseResponseDto {
  @ApiProperty({ example: '123454e1-9bba-4447-a00e-567334cc51d4', description: 'Unique identifier of the purchase' })
  id: string;

  @ApiProperty({ example: '3d1e10b-feb3-48f9-a19c-6f95e7f416bc', description: 'ID of the provider who made the sale' })
  idProvider: string;

  @ApiProperty({ example: '2025-07-04', description: 'Date of the purchase (YYYY-MM-DD)' })
  purchaseDate: string;

  @ApiProperty({ example: 10, description: 'Total number of cattle in the purchase' })
  totalCattle: number;

  @ApiProperty({ example: 10000, description: 'Total weight (kg) of cattle in the purchase' })
  totalWeight: number;

  @ApiProperty({ type: [LotResponseDto], description: 'List of lots involved in this purchase' })
  lots: LotResponseDto[];

  @ApiProperty({ example: 'OPEN', enum: ['OPEN', 'RECEIVED'] })
  status: string;


  static toPurchaseResponse(purchase: Purchase): PurchaseResponseDto {
    return {
      id: purchase.id,
      idProvider: purchase.idProvider,
      purchaseDate:
        purchase.purchaseDate instanceof Date
          ? purchase.purchaseDate.toISOString().slice(0, 10)
          : String(purchase.purchaseDate).slice(0, 10),
      totalCattle: purchase.totalCattle,
      totalWeight: purchase.totalWeight,
      status: purchase.status,
      lots: purchase.lots ? purchase.lots.map(LotResponseDto.toLotResponse) : []
    };
  }
  // lots: purchase.lots.map(lot => LotResponseDto.toLotResponse(lot))
}
