import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { SalesService } from './sales.service';
import { CattleDeviceHistoryRepository } from '../../farm/repositories/cattle-device-history.repository';
import { DevicesService } from '../../production-center/services/devices.service';
import { CattleRepository } from '../../farm/repositories/cattle.repository';
import { Sale } from '../entities/sale.entity';
import { SaleDetail } from '../entities/sale-detail.entity';
import { Cattle, CattleStatus } from '../../farm/entities/cattle.entity';
import { UpdateSaleDto } from '../dto/update-sale.dto';

describe('SalesService', () => {
  let service: SalesService;
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let deviceService: jest.Mocked<Pick<DevicesService, 'findById' | 'updateWithDevice'>>;
  let cattleDeviceHistoryRepository: jest.Mocked<
    Pick<CattleDeviceHistoryRepository, 'unassignDeviceByidCattle'>
  >;

  const tenantId = 'tenant-1';
  const saleId = 'sale-1';
  const cattleId = 'cattle-1';

  const existingSale = {
    id: saleId,
    idTenant: tenantId,
    buyerId: 'buyer-1',
    transactionDate: new Date('2025-01-15'),
  } as Sale;

  const existingDetail = {
    id: 'detail-1',
    saleId,
    cattleId,
    idTenant: tenantId,
    measuredWeight: 400,
    calculatedPrice: 2000,
    isApproved: true,
    trackerRemoved: false,
  } as SaleDetail;

  let manager: {
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(() => {
    manager = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(async (_entity, value) => value),
      create: jest.fn((_entity, value) => value),
    };

    dataSource = {
      transaction: jest.fn(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager as unknown as EntityManager)),
      getRepository: jest.fn(),
    };

    deviceService = {
      findById: jest.fn(),
      updateWithDevice: jest.fn(),
    };
    cattleDeviceHistoryRepository = {
      unassignDeviceByidCattle: jest.fn(),
    };

    service = new SalesService(
      dataSource as unknown as DataSource,
      deviceService as unknown as DevicesService,
      cattleDeviceHistoryRepository as unknown as CattleDeviceHistoryRepository,
      {} as CattleRepository,
    );
  });

  const baseUpdateDto = (): UpdateSaleDto =>
    ({
      transactionDate: new Date('2025-02-01'),
      buyerId: 'buyer-2',
      minWeightConfig: 350,
      valuePerKgConfig: 5,
      totalAnimalCount: 1,
      totalWeightKg: 410,
      totalAmount: 2050,
      notes: 'updated',
      details: [
        {
          cattleId,
          cattleNumber: '100',
          measuredWeight: 410,
          calculatedPrice: 2050,
          isApproved: true,
          trackerRemoved: false,
        },
      ],
    }) as UpdateSaleDto;

  function mockSaleLock(sale: Sale | null) {
    const qb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(sale),
    };
    manager.createQueryBuilder.mockReturnValueOnce(qb);
    return qb;
  }

  describe('update', () => {
    it('throws NotFoundException when sale does not exist', async () => {
      mockSaleLock(null);

      await expect(service.update(tenantId, saleId, baseUpdateDto())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException when details are missing', async () => {
      await expect(
        service.update(tenantId, saleId, { buyerId: 'buyer-1' } as UpdateSaleDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates header and existing approved detail', async () => {
      mockSaleLock(existingSale);
      manager.find.mockResolvedValueOnce([existingDetail]);
      manager.findOne.mockResolvedValueOnce({
        ...existingSale,
        details: [existingDetail],
      });

      const result = await service.update(tenantId, saleId, baseUpdateDto());

      expect(manager.update).toHaveBeenCalledWith(
        Sale,
        { id: saleId, idTenant: tenantId },
        expect.objectContaining({
          buyerId: 'buyer-2',
          totalAmount: 2050,
          totalWeightKg: 410,
          totalAnimalCount: 1,
        }),
      );
      expect(manager.save).toHaveBeenCalledWith(
        SaleDetail,
        expect.objectContaining({ cattleId, measuredWeight: 410 }),
      );
      expect(manager.update).toHaveBeenCalledWith(
        Cattle,
        { id: cattleId, idTenant: tenantId },
        expect.objectContaining({
          status: CattleStatus.SOLD,
          idProvider: 'buyer-2',
        }),
      );
      expect(result).toMatchObject({ id: saleId });
    });

    it('reverts cattle when approved detail is removed from payload', async () => {
      mockSaleLock(existingSale);
      manager.find.mockResolvedValueOnce([existingDetail]);
      manager.findOne.mockResolvedValueOnce({ ...existingSale, details: [] });

      const dto = baseUpdateDto();
      dto.details = [];

      await expect(service.update(tenantId, saleId, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects duplicate cattle in another sale via assertCattleCanBeAddedToSale', async () => {
      mockSaleLock(existingSale);
      manager.find.mockResolvedValueOnce([existingDetail]);
      manager.findOne
        .mockResolvedValueOnce({
          id: 'other-cattle',
          idTenant: tenantId,
          status: CattleStatus.ACTIVE,
        } as Cattle);

      const otherDetailQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'other-detail', saleId: 'other-sale' }),
      };
      manager.createQueryBuilder.mockReturnValueOnce(otherDetailQb);

      const dto = baseUpdateDto();
      dto.details = [
        {
          cattleId: 'other-cattle',
          cattleNumber: '200',
          measuredWeight: 300,
          calculatedPrice: 1500,
          isApproved: true,
        },
      ] as UpdateSaleDto['details'];

      await expect(service.update(tenantId, saleId, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('reverts cattle when approved detail changes to rejected', async () => {
      mockSaleLock(existingSale);
      manager.find.mockResolvedValueOnce([existingDetail]);
      manager.findOne.mockResolvedValueOnce({
        ...existingSale,
        details: [{ ...existingDetail, isApproved: false }],
      });

      const dto = baseUpdateDto();
      dto.details![0].isApproved = false;
      dto.details![0].rejectionReason = 'Under weight';
      dto.totalAnimalCount = 0;
      dto.totalWeightKg = 0;
      dto.totalAmount = 0;

      await service.update(tenantId, saleId, dto);

      expect(manager.update).toHaveBeenCalledWith(
        Cattle,
        { id: cattleId, idTenant: tenantId },
        expect.objectContaining({ status: CattleStatus.ACTIVE }),
      );
    });
  });
});
