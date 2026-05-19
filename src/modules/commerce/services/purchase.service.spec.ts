import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PurchaseService } from './purchase.service';
import { PurchaseRepository } from '../repositories/purchase.repository';
import { LotRepository } from '../repositories/lot.repository';
import { PurchaseStatus } from '../enums/purchase-status.enum';
import { Purchase } from '../entities/purchase.entity';
import { UpdatePurchaseDto } from '../dto/update-purchase.dto';
import { CattleGender } from '../../farm/enums/cattle-gender.enum';

describe('PurchaseService', () => {
  let service: PurchaseService;
  let purchaseRepository: jest.Mocked<
    Pick<
      PurchaseRepository,
      | 'findById'
      | 'countReceivedCattle'
      | 'createInstance'
      | 'saveWithManager'
      | 'deleteById'
    >
  >;
  let lotRepository: jest.Mocked<
    Pick<LotRepository, 'deleteByPurchaseIdWithManager' | 'createInstance' | 'saveWithManager'>
  >;
  let dataSource: { createQueryRunner: jest.Mock };

  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const purchaseId = 'purchase-1';

  const openPurchase = {
    id: purchaseId,
    idTenant: tenantId,
    status: PurchaseStatus.OPEN,
    idProvider: 'provider-1',
    purchaseDate: new Date('2025-01-01'),
    totalCattle: 1,
    totalWeight: 100,
    lots: [],
  } as unknown as Purchase;

  beforeEach(() => {
    purchaseRepository = {
      findById: jest.fn(),
      countReceivedCattle: jest.fn(),
      createInstance: jest.fn(),
      saveWithManager: jest.fn(),
      deleteById: jest.fn(),
    };
    lotRepository = {
      deleteByPurchaseIdWithManager: jest.fn(),
      createInstance: jest.fn((data) => data as never),
      saveWithManager: jest.fn(async (_m, lot) => lot as never),
    };
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {},
    };
    dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    };
    service = new PurchaseService(
      dataSource as unknown as DataSource,
      purchaseRepository as unknown as PurchaseRepository,
      lotRepository as unknown as LotRepository,
    );
  });

  describe('updatePurchase', () => {
    const dto = {
      idProvider: 'provider-2',
      purchaseDate: '2025-02-01',
      lots: [
        {
          lotNumber: 'L1',
          originPlace: 'Farm',
          purchasedCattleCount: 2,
          totalWeight: 200,
          pricePerKg: 5000,
          totalValue: 1000000,
          gender: CattleGender.MALE,
        },
      ],
    } as UpdatePurchaseDto;

    it('rejects when purchase is RECEIVED', async () => {
      purchaseRepository.findById.mockResolvedValue({
        ...openPurchase,
        status: PurchaseStatus.RECEIVED,
      } as Purchase);

      await expect(
        service.updatePurchase(purchaseId, dto, tenantId, userId),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects when reception already started', async () => {
      purchaseRepository.findById.mockResolvedValue(openPurchase);
      purchaseRepository.countReceivedCattle.mockResolvedValue(1);

      await expect(
        service.updatePurchase(purchaseId, dto, tenantId, userId),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects when lots array is empty', async () => {
      purchaseRepository.findById.mockResolvedValue(openPurchase);
      purchaseRepository.countReceivedCattle.mockResolvedValue(0);

      await expect(
        service.updatePurchase(purchaseId, { ...dto, lots: [] }, tenantId, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound when purchase missing', async () => {
      purchaseRepository.findById.mockResolvedValue(null);

      await expect(
        service.updatePurchase(purchaseId, dto, tenantId, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
