import { ApiProperty } from '@nestjs/swagger';
import { Provider } from '../entities/provider.entity';

export class ProviderResponseDto {
  @ApiProperty({ example: 'c3d1e10b-feb3-48f9-a19c-6f95e7f416bc' })
  id: string;

  @ApiProperty({ example: 'Ganadería El Porvenir' })
  name: string;

  @ApiProperty({ example: '900123456-7' })
  nit: string;

  @ApiProperty({ example: '2025-07-03T18:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2025-07-04T10:32:00.000Z' })
  updated_at: Date;

    /**
   * Convert a Provider entity to a ProviderResponseDto
   * @param provider - The Provider entity
   * @returns The ProviderResponseDto
   */
    public static toProviderResponse(provider: Provider): ProviderResponseDto {
      return {
        id: provider.id,
        name: provider.name,
        nit: provider.nit,
        created_at: provider.created_at,
        updated_at: provider.updated_at,
      };
    }
}
