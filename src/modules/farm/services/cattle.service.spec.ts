jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000001'),
  };
});

import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CattleService } from './cattle.service';
import { CattleRepository } from '../repositories/cattle.repository';
import { CattleDeviceHistoryRepository } from '../repositories/cattle-device-history.repository';
import { CattleWeightHistoryRepository } from '../repositories/cattle-weight-history.repository';
import { CattleEartagHistoryRepository } from '../repositories/cattle-eartag-history.repository';
import { CattleMedicationHistoryRepository } from '../repositories/cattle-medication-history.repository';
import { CattleCharacteristicRepository } from '../repositories/cattle-characteristic.repository';
import { DevicesService } from '../../production-center/services/devices.service';
import { AnimalSimpleEventRepository } from 'src/modules/massive-events/repositories/animal-simple-event.repository';
import { MassiveEventService } from 'src/modules/massive-events/services/massive-event.service';
import { SimpleEventService } from 'src/modules/massive-events/services/simple-event.service';
import { SalesService } from 'src/modules/commerce/services/sales.service';
import { ConfigurationsService } from 'src/modules/configurations/services/configurations.service';
import { Cattle, CattleStatus } from '../entities/cattle.entity';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';
import { WeightContext } from '../entities/cattle-weight-history.entity';
import { SimpleEventType } from 'src/modules/massive-events/enums/simple-event-type.enum';
import { SyncAnimalSimpleEventDto } from 'src/modules/massive-events/dto/sync-animal-simple-event.dto';
import { DentitionEstimationService } from './dentition-estimation.service';
import { CattleAgeHistoryRepository } from '../repositories/cattle-age-history.repository';

describe('CattleService', () => {
  let service: CattleService;
  let cattleRepository: {
    findOne: jest.Mock;
    findByNumberAndTenantId: jest.Mock;
    search: jest.Mock;
    findAll: jest.Mock;
    delete: jest.Mock;
  };

  const tenantId = 'tenant-1';
  const cattleId = 'cattle-1';
  const number = 'NUM-100';

  const empty = {} as never;

  beforeEach(() => {
    cattleRepository = {
      findOne: jest.fn(),
      findByNumberAndTenantId: jest.fn(),
      search: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
    };

    service = new CattleService(
      cattleRepository as unknown as CattleRepository,
      empty as CattleDeviceHistoryRepository,
      empty as CattleWeightHistoryRepository,
      empty as CattleEartagHistoryRepository,
      empty as CattleMedicationHistoryRepository,
      empty as CattleCharacteristicRepository,
      empty as DevicesService,
      empty as AnimalSimpleEventRepository,
      empty as DataSource,
      empty as MassiveEventService,
      empty as SimpleEventService,
      empty as SalesService,
      empty as ConfigurationsService,
      empty as never,
      empty as never,
    );
  });

  describe('findByIdOrFail', () => {
    it('devuelve el animal cuando existe', async () => {
      const row = { id: cattleId, idTenant: tenantId } as unknown as Cattle;
      cattleRepository.findOne.mockResolvedValue(row);

      const out = await service.findByIdOrFail(tenantId, cattleId);

      expect(out).toBe(row);
      expect(cattleRepository.findOne).toHaveBeenCalledWith(tenantId, cattleId, undefined);
    });

    it('lanza NotFoundException cuando no existe', async () => {
      cattleRepository.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(tenantId, cattleId)).rejects.toThrow(NotFoundException);
    });

    it('reenvía EntityManager al repositorio cuando se provee', async () => {
      const manager = {} as EntityManager;
      const row = { id: cattleId, idTenant: tenantId } as unknown as Cattle;
      cattleRepository.findOne.mockResolvedValue(row);

      const out = await service.findByIdOrFail(tenantId, cattleId, manager);

      expect(out).toBe(row);
      expect(cattleRepository.findOne).toHaveBeenCalledWith(tenantId, cattleId, manager);
    });
  });

  describe('findByNumberOrFail', () => {
    it('devuelve el animal cuando existe', async () => {
      const row = { id: cattleId, idTenant: tenantId, number } as unknown as Cattle;
      cattleRepository.findByNumberAndTenantId.mockResolvedValue(row);

      const out = await service.findByNumberOrFail(tenantId, number);

      expect(out).toBe(row);
      expect(cattleRepository.findByNumberAndTenantId).toHaveBeenCalledWith(tenantId, number, undefined);
    });

    it('lanza NotFoundException cuando no existe', async () => {
      cattleRepository.findByNumberAndTenantId.mockResolvedValue(null);

      await expect(service.findByNumberOrFail(tenantId, number)).rejects.toThrow(NotFoundException);
    });

    it('reenvía EntityManager al repositorio cuando se provee', async () => {
      const manager = {} as EntityManager;
      const row = { id: cattleId, idTenant: tenantId, number } as unknown as Cattle;
      cattleRepository.findByNumberAndTenantId.mockResolvedValue(row);

      const out = await service.findByNumberOrFail(tenantId, number, manager);

      expect(out).toBe(row);
      expect(cattleRepository.findByNumberAndTenantId).toHaveBeenCalledWith(tenantId, number, manager);
    });
  });

  describe('search', () => {
    it('retorna array vacío si query está vacío y no llama al repositorio', async () => {
      const out = await service.search(tenantId, '');
      expect(out).toEqual([]);
      expect(cattleRepository.search).not.toHaveBeenCalled();
    });

    it('retorna array vacío si query solo tiene espacios', async () => {
      const out = await service.search(tenantId, '   ');
      expect(out).toEqual([]);
      expect(cattleRepository.search).not.toHaveBeenCalled();
    });

    it('busca solo ganado ACTIVE cuando el query es válido', async () => {
      const rows = [{ id: cattleId }] as unknown as Cattle[];
      cattleRepository.search.mockResolvedValue(rows);

      const out = await service.search(tenantId, '123');

      expect(out).toBe(rows);
      expect(cattleRepository.search).toHaveBeenCalledWith(tenantId, '123', [CattleStatus.ACTIVE]);
    });
  });

  describe('list', () => {
    it('delega en cattleRepository.findAll', async () => {
      const rows = [{ id: cattleId }] as unknown as Cattle[];
      cattleRepository.findAll.mockResolvedValue(rows);

      const out = await service.list(tenantId);

      expect(out).toBe(rows);
      expect(cattleRepository.findAll).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('remove', () => {
    it('delega en cattleRepository.delete', async () => {
      cattleRepository.delete.mockResolvedValue(undefined);

      await service.remove(tenantId, cattleId);

      expect(cattleRepository.delete).toHaveBeenCalledWith(tenantId, cattleId);
    });
  });

  describe('validateCattleByNumber', () => {
    it('lanza BadRequestException si no existe el animal', async () => {
      cattleRepository.findByNumberAndTenantId.mockResolvedValue(null);

      await expect(service.validateCattleByNumber(number, tenantId)).rejects.toThrow(
        new BadRequestException(`Cattle with number ${number} not found for this tenant`),
      );
    });

    it('retorna cattle si está ACTIVE', async () => {
      const cattle = { id: cattleId, number, status: CattleStatus.ACTIVE } as unknown as Cattle;
      cattleRepository.findByNumberAndTenantId.mockResolvedValue(cattle);

      const out = await service.validateCattleByNumber(number, tenantId);

      expect(out).toBe(cattle);
    });

    it.each([
      [CattleStatus.SOLD, 'already been sold'],
      [CattleStatus.DEAD, 'marked as dead'],
      [CattleStatus.LOST, 'marked as lost'],
    ])('lanza BadRequestException si status es %s', async (status, fragment) => {
      cattleRepository.findByNumberAndTenantId.mockResolvedValue({
        id: cattleId,
        number,
        status,
      } as unknown as Cattle);

      await expect(service.validateCattleByNumber(number, tenantId)).rejects.toThrow(fragment);
    });
  });
});

describe('CattleService (transacciones y reglas de negocio)', () => {
  let service: CattleService;
  let dataSource: { transaction: jest.Mock };
  let mockManager: { save: jest.Mock };
  let cattleRepository: {
    create: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    findByNumberAndTenantId: jest.Mock;
    findByAnyEartag: jest.Mock;
    unsetDevice: jest.Mock;
    saveWithManager: jest.Mock;
    findOneForUpdateByNumber: jest.Mock;
  };
  let cattleDeviceHistoryRepository: {
    unassignDeviceByidDevice: jest.Mock;
    assignDeviceToCattle: jest.Mock;
    unassignDeviceByidCattle: jest.Mock;
  };
  let cattleWeightHistoryRepository: {
    create: jest.Mock;
    findLastByCattle: jest.Mock;
    findByCattle: jest.Mock;
    createWithManager: jest.Mock;
    update: jest.Mock;
  };
  let cattleEartagHistoryRepository: { createWithManager: jest.Mock };
  let cattleMedicationHistoryRepository: { createWithManager: jest.Mock; findByCattle: jest.Mock };
  let cattleCharacteristicRepository: { attachMany: jest.Mock };
  let deviceService: { findById: jest.Mock; findOne: jest.Mock; updateWithDevice: jest.Mock };
  let animalSimpleEventRepository: { saveWithManager: jest.Mock };
  let massiveEventService: { findWithSimpleEventsByIdOrFail: jest.Mock };
  let simpleEventService: { findByIdOrFail: jest.Mock };
  let salesService: { syncSaleDataForSoldCattle: jest.Mock };
  let configurationsService: { getTenantConfiguration: jest.Mock };

  const tenantId = 'tenant-1';
  const cattleId = 'cattle-1';
  const userId = 'user-1';

  beforeEach(() => {
    mockManager = { save: jest.fn().mockResolvedValue(undefined) };
    dataSource = {
      transaction: jest.fn(async (cb: (m: EntityManager) => unknown) => cb(mockManager as unknown as EntityManager)),
    };
    cattleRepository = {
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      findByNumberAndTenantId: jest.fn(),
      findByAnyEartag: jest.fn(),
      unsetDevice: jest.fn(),
      saveWithManager: jest.fn(),
      findOneForUpdateByNumber: jest.fn(),
    };
    cattleDeviceHistoryRepository = {
      unassignDeviceByidDevice: jest.fn().mockResolvedValue(undefined),
      assignDeviceToCattle: jest.fn().mockResolvedValue(undefined),
      unassignDeviceByidCattle: jest.fn().mockResolvedValue(undefined),
    };
    cattleWeightHistoryRepository = {
      create: jest.fn().mockResolvedValue(undefined),
      findLastByCattle: jest.fn(),
      findByCattle: jest.fn().mockResolvedValue([]),
      createWithManager: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    cattleEartagHistoryRepository = { createWithManager: jest.fn().mockResolvedValue(undefined) };
    cattleMedicationHistoryRepository = {
      createWithManager: jest.fn().mockResolvedValue(undefined),
      findByCattle: jest.fn().mockResolvedValue([]),
    };
    cattleCharacteristicRepository = { attachMany: jest.fn().mockResolvedValue(undefined) };
    deviceService = {
      findById: jest.fn(),
      findOne: jest.fn(),
      updateWithDevice: jest.fn(),
    };
    animalSimpleEventRepository = { saveWithManager: jest.fn().mockResolvedValue({}) };
    massiveEventService = { findWithSimpleEventsByIdOrFail: jest.fn() };
    simpleEventService = { findByIdOrFail: jest.fn().mockResolvedValue({}) };
    salesService = {
      syncSaleDataForSoldCattle: jest.fn().mockResolvedValue({
        saleId: 'sale-1',
        totalAmount: 100,
        totalWeightKg: 500,
      }),
    };
    configurationsService = { getTenantConfiguration: jest.fn() };

    service = new CattleService(
      cattleRepository as unknown as CattleRepository,
      cattleDeviceHistoryRepository as unknown as CattleDeviceHistoryRepository,
      cattleWeightHistoryRepository as unknown as CattleWeightHistoryRepository,
      cattleEartagHistoryRepository as unknown as CattleEartagHistoryRepository,
      cattleMedicationHistoryRepository as unknown as CattleMedicationHistoryRepository,
      cattleCharacteristicRepository as unknown as CattleCharacteristicRepository,
      deviceService as unknown as DevicesService,
      animalSimpleEventRepository as unknown as AnimalSimpleEventRepository,
      dataSource as unknown as DataSource,
      massiveEventService as unknown as MassiveEventService,
      simpleEventService as unknown as SimpleEventService,
      salesService as unknown as SalesService,
      configurationsService as unknown as ConfigurationsService,
      {} as never,
      {} as never,
    );

    (randomUUID as jest.Mock).mockReturnValue('00000000-0000-4000-8000-000000000001');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const baseCreateDto = (): CreateCattleDto =>
    ({
      sysNumber: '1',
      number: 'N-NEW',
      receivedAt: '2025-01-01',
      receivedWeight: 300,
      purchaseWeight: 300,
      purchasePrice: 3000,
    }) as CreateCattleDto;

  describe('create', () => {
    it('ejecuta transacción, asigna idTenant y crea ganado sin device ni lastWeight', async () => {
      const created = { id: cattleId, number: 'N-NEW' } as unknown as Cattle;
      cattleRepository.create.mockResolvedValue(created);

      const dto = baseCreateDto();
      const out = await service.create(tenantId, dto, userId);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(dto.idTenant).toBe(tenantId);
      expect(cattleRepository.create).toHaveBeenCalledWith(dto, mockManager);
      expect(cattleWeightHistoryRepository.create).not.toHaveBeenCalled();
      expect(deviceService.findById).not.toHaveBeenCalled();
      expect(out).toBe(created);
    });

    it('con lastWeight crea historial MANUAL', async () => {
      cattleRepository.create.mockResolvedValue({ id: cattleId } as Cattle);
      const dto = { ...baseCreateDto(), lastWeight: 420 };

      await service.create(tenantId, dto, userId);

      expect(cattleWeightHistoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          idTenant: tenantId,
          idCattle: cattleId,
          weight: 420,
          context: WeightContext.MANUAL,
        }),
        mockManager,
      );
    });

    it('con idDevice válido asocia dispositivo al ganado', async () => {
      const device = { id: 'dev-1', tags: {} as Record<string, string> };
      deviceService.findById.mockResolvedValue(device as never);
      deviceService.updateWithDevice.mockResolvedValue(device as never);
      const created = { id: cattleId, number: 'N-NEW', device } as unknown as Cattle;
      cattleRepository.create.mockResolvedValue(created);

      const dto = { ...baseCreateDto(), idDevice: 'dev-1' };
      const out = await service.create(tenantId, dto, userId);

      expect(cattleDeviceHistoryRepository.assignDeviceToCattle).toHaveBeenCalledWith(
        'dev-1',
        cattleId,
        tenantId,
        userId,
        expect.any(Date),
        undefined,
        expect.anything(),
      );
      expect(out.device).toBe(device);
    });

    it('lanza NotFoundException si idDevice no existe', async () => {
      deviceService.findById.mockResolvedValue(null);
      const dto = { ...baseCreateDto(), idDevice: 'dev-1' };

      await expect(service.create(tenantId, dto, userId)).rejects.toThrow(
        new NotFoundException('Device dev-1 not found'),
      );
    });
  });

  describe('update', () => {
    it('lanza NotFoundException si el ganado no existe', async () => {
      cattleRepository.findOne.mockResolvedValue(null);
      await expect(
        service.update(tenantId, cattleId, { number: 'X' } as UpdateCattleDto, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ConflictException si el número ya existe en otro animal ACTIVE', async () => {
      cattleRepository.findOne.mockResolvedValue({
        id: cattleId,
        status: CattleStatus.ACTIVE,
      } as Cattle);
      cattleRepository.findByNumberAndTenantId.mockResolvedValue({
        id: 'other',
        status: CattleStatus.ACTIVE,
      } as Cattle);
      cattleRepository.update.mockResolvedValue({});
      cattleWeightHistoryRepository.findByCattle.mockResolvedValue([]);
      configurationsService.getTenantConfiguration.mockResolvedValue(null);

      await expect(
        service.update(tenantId, cattleId, { number: 'DUP' } as UpdateCattleDto, userId),
      ).rejects.toThrow(ConflictException);
    });

    it('lanza ConflictException si eartagLeft está en otro animal', async () => {
      cattleRepository.findOne.mockResolvedValue({ id: cattleId, status: CattleStatus.ACTIVE } as Cattle);
      cattleRepository.findByAnyEartag.mockResolvedValue({ id: 'other', status: CattleStatus.ACTIVE } as Cattle);

      await expect(
        service.update(tenantId, cattleId, { eartagLeft: 'E-1' } as UpdateCattleDto, userId),
      ).rejects.toThrow(/Eartag E-1/);
    });

    it('lanza ConflictException si eartagRight está en otro animal', async () => {
      cattleRepository.findOne.mockResolvedValue({ id: cattleId, status: CattleStatus.ACTIVE } as Cattle);
      cattleRepository.findByAnyEartag.mockResolvedValue({ id: 'other', status: CattleStatus.ACTIVE } as Cattle);

      await expect(
        service.update(tenantId, cattleId, { eartagRight: 'E-R1' } as UpdateCattleDto, userId),
      ).rejects.toThrow(/Eartag E-R1/);
    });

    it('rechaza salePrice si el animal no está SOLD', async () => {
      cattleRepository.findOne.mockResolvedValue({ id: cattleId, status: CattleStatus.ACTIVE } as Cattle);
      await expect(
        service.update(tenantId, cattleId, { salePrice: 10 } as UpdateCattleDto, userId),
      ).rejects.toThrow(new BadRequestException('SALE_FIELDS_ONLY_FOR_SOLD_CATTLE'));
    });

    it('rechaza salePrice negativo en animal SOLD', async () => {
      cattleRepository.findOne.mockResolvedValue({ id: cattleId, status: CattleStatus.SOLD } as Cattle);
      cattleRepository.update.mockResolvedValue({});
      cattleWeightHistoryRepository.findByCattle.mockResolvedValue([]);
      configurationsService.getTenantConfiguration.mockResolvedValue(null);

      await expect(
        service.update(tenantId, cattleId, { salePrice: -1 } as UpdateCattleDto, userId),
      ).rejects.toThrow(new BadRequestException('INVALID_SALE_PRICE'));
    });

    it('rechaza saleWeight negativo en animal SOLD', async () => {
      cattleRepository.findOne.mockResolvedValue({ id: cattleId, status: CattleStatus.SOLD } as Cattle);
      cattleRepository.update.mockResolvedValue({});
      cattleWeightHistoryRepository.findByCattle.mockResolvedValue([]);
      configurationsService.getTenantConfiguration.mockResolvedValue(null);

      await expect(
        service.update(tenantId, cattleId, { saleWeight: -1 } as UpdateCattleDto, userId),
      ).rejects.toThrow(new BadRequestException('INVALID_SALE_WEIGHT'));
    });

    it('para SOLD válido sincroniza venta y expone totales', async () => {
      cattleRepository.findOne.mockResolvedValue({ id: cattleId, status: CattleStatus.SOLD, lastWeight: 400 } as Cattle);
      cattleRepository.update.mockResolvedValue({});
      cattleWeightHistoryRepository.findByCattle.mockResolvedValue([]);
      configurationsService.getTenantConfiguration.mockResolvedValue(null);

      const out = await service.update(
        tenantId,
        cattleId,
        { salePrice: 100, saleWeight: 400 } as UpdateCattleDto,
        userId,
      );

      expect(salesService.syncSaleDataForSoldCattle).toHaveBeenCalled();
      expect(out.affectedSaleId).toBe('sale-1');
      expect(out.affectedSaleTotals).toEqual({ totalAmount: 100, totalWeightKg: 500 });
    });

    describe('lastWeight y ganancia diaria', () => {
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
      });
      afterEach(() => {
        jest.useRealTimers();
      });

      it('calcula averageDailyGain con historial previo', async () => {
        cattleRepository.findOne
          .mockResolvedValueOnce({ id: cattleId, status: CattleStatus.ACTIVE, lastWeight: 300 } as Cattle)
          .mockResolvedValueOnce({
            id: cattleId,
            status: CattleStatus.ACTIVE,
            lastWeight: 330,
            averageDailyGain: 3,
          } as Cattle);
        cattleRepository.update.mockResolvedValue({});
        cattleWeightHistoryRepository.findLastByCattle.mockResolvedValue({
          weight: 300,
          date: new Date('2025-01-05T12:00:00.000Z'),
        } as never);
        cattleWeightHistoryRepository.findByCattle.mockResolvedValue([]);
        configurationsService.getTenantConfiguration.mockResolvedValue(null);

        await service.update(tenantId, cattleId, { lastWeight: 330 } as UpdateCattleDto, userId);

        expect(cattleRepository.update).toHaveBeenCalledWith(
          tenantId,
          cattleId,
          expect.objectContaining({ lastWeight: 330, averageDailyGain: 3 }),
          expect.anything(),
        );
      });
    });
  });

  describe('applyMultipleSimpleEventsByNumber_transaction', () => {
    const ev = () => [
      {
        type: SimpleEventType.WEIGHT,
        data: { weight: 410 },
        idSimpleEvent: 'se-1',
      },
    ];

    it('con EntityManager no abre nueva transacción', async () => {
      massiveEventService.findWithSimpleEventsByIdOrFail.mockResolvedValue({
        status: 'open',
        simpleEvents: [],
      } as never);
      cattleRepository.findOneForUpdateByNumber.mockResolvedValue({
        id: cattleId,
        status: CattleStatus.ACTIVE,
        number: 'N1',
      } as Cattle);
      cattleWeightHistoryRepository.findLastByCattle.mockResolvedValue(null);
      cattleRepository.saveWithManager.mockResolvedValue(undefined);

      await service.applyMultipleSimpleEventsByNumber_transaction(
        tenantId,
        userId,
        'N1',
        'me-1',
        ev(),
        mockManager as unknown as EntityManager,
      );

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('sin manager delega en dataSource.transaction', async () => {
      massiveEventService.findWithSimpleEventsByIdOrFail.mockResolvedValue({
        status: 'open',
        simpleEvents: [],
      } as never);
      cattleRepository.findOneForUpdateByNumber.mockResolvedValue({
        id: cattleId,
        status: CattleStatus.ACTIVE,
        number: 'N1',
      } as Cattle);
      cattleWeightHistoryRepository.findLastByCattle.mockResolvedValue(null);
      cattleRepository.saveWithManager.mockResolvedValue(undefined);

      await service.applyMultipleSimpleEventsByNumber_transaction(tenantId, userId, 'N1', 'me-1', ev());

      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });

  describe('applyMultipleSimpleEventsByNumber_manager', () => {
    it('lanza HttpException 422 si el massive event está cerrado', async () => {
      massiveEventService.findWithSimpleEventsByIdOrFail.mockResolvedValue({
        status: 'closed',
        simpleEvents: [],
      } as never);

      await expect(
        service.applyMultipleSimpleEventsByNumber_manager(
          tenantId,
          userId,
          'N1',
          'me-1',
          [{ type: SimpleEventType.WEIGHT, data: { weight: 1 }, idSimpleEvent: 's1' }],
          mockManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('lanza NotFoundException si no hay cattle con ese número', async () => {
      massiveEventService.findWithSimpleEventsByIdOrFail.mockResolvedValue({ status: 'open', simpleEvents: [] } as never);
      cattleRepository.findOneForUpdateByNumber.mockResolvedValue(null);

      await expect(
        service.applyMultipleSimpleEventsByNumber_manager(
          tenantId,
          userId,
          'N1',
          'me-1',
          [{ type: SimpleEventType.WEIGHT, data: { weight: 1 }, idSimpleEvent: 's1' }],
          mockManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('aplicando WEIGHT crea historial de evento y persiste cattle', async () => {
      massiveEventService.findWithSimpleEventsByIdOrFail.mockResolvedValue({ status: 'open', simpleEvents: [] } as never);
      cattleRepository.findOneForUpdateByNumber.mockResolvedValue({
        id: cattleId,
        status: CattleStatus.ACTIVE,
        number: 'N1',
      } as Cattle);
      cattleWeightHistoryRepository.findLastByCattle.mockResolvedValue(null);
      simpleEventService.findByIdOrFail.mockResolvedValue({ id: 'se-1' } as never);
      cattleRepository.saveWithManager.mockResolvedValue(undefined);
      mockManager.save.mockResolvedValue(undefined);

      await service.applyMultipleSimpleEventsByNumber_manager(
        tenantId,
        userId,
        'N1',
        'me-1',
        [{ type: SimpleEventType.WEIGHT, data: { weight: 410 }, idSimpleEvent: 'se-1' }],
        mockManager as unknown as EntityManager,
      );

      expect(cattleWeightHistoryRepository.createWithManager).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          idCattle: cattleId,
          weight: 410,
          context: WeightContext.EVENT,
        }),
      );
      expect(animalSimpleEventRepository.saveWithManager).toHaveBeenCalled();
      expect(cattleRepository.saveWithManager).toHaveBeenCalled();
      expect(mockManager.save).toHaveBeenCalledWith(Cattle, expect.objectContaining({ lastWeight: 410 }));
    });

    it('lanza ConflictException si EARTAG duplicado en otro animal', async () => {
      massiveEventService.findWithSimpleEventsByIdOrFail.mockResolvedValue({ status: 'open', simpleEvents: [] } as never);
      cattleRepository.findOneForUpdateByNumber.mockResolvedValue({
        id: cattleId,
        status: CattleStatus.ACTIVE,
        number: 'N1',
      } as Cattle);
      simpleEventService.findByIdOrFail.mockResolvedValue({ id: 'se-1' } as never);
      cattleRepository.findByAnyEartag.mockResolvedValue({ id: 'other', status: CattleStatus.ACTIVE } as Cattle);

      await expect(
        service.applyMultipleSimpleEventsByNumber_manager(
          tenantId,
          userId,
          'N1',
          'me-1',
          [{ type: SimpleEventType.EARTAG, data: { eartagLeft: 'E-DUP' }, idSimpleEvent: 'se-1' }],
          mockManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('lanza NotFoundException si TRACKER referencia dispositivo inexistente', async () => {
      massiveEventService.findWithSimpleEventsByIdOrFail.mockResolvedValue({ status: 'open', simpleEvents: [] } as never);
      cattleRepository.findOneForUpdateByNumber.mockResolvedValue({
        id: cattleId,
        status: CattleStatus.ACTIVE,
        number: 'N1',
      } as Cattle);
      simpleEventService.findByIdOrFail.mockResolvedValue({ id: 'se-1' } as never);
      deviceService.findById.mockResolvedValue(null);

      await expect(
        service.applyMultipleSimpleEventsByNumber_manager(
          tenantId,
          userId,
          'N1',
          'me-1',
          [{ type: SimpleEventType.TRACKER, data: { tracker_id: 'dev-x' }, idSimpleEvent: 'se-1' }],
          mockManager as unknown as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('aplicando MEDICATION persiste en historial de medicación', async () => {
      massiveEventService.findWithSimpleEventsByIdOrFail.mockResolvedValue({ status: 'open', simpleEvents: [] } as never);
      cattleRepository.findOneForUpdateByNumber.mockResolvedValue({
        id: cattleId,
        status: CattleStatus.ACTIVE,
        number: 'N1',
      } as Cattle);
      cattleWeightHistoryRepository.findLastByCattle.mockResolvedValue(null);
      simpleEventService.findByIdOrFail.mockResolvedValue({ id: 'se-1' } as never);
      cattleRepository.saveWithManager.mockResolvedValue(undefined);
      mockManager.save.mockResolvedValue(undefined);

      await service.applyMultipleSimpleEventsByNumber_manager(
        tenantId,
        userId,
        'N1',
        'me-1',
        [
          {
            type: SimpleEventType.MEDICATION,
            data: { medicationName: 'M', dosage: '1', lot: 'L', route: 'oral' },
            idSimpleEvent: 'se-1',
          },
        ],
        mockManager as unknown as EntityManager,
      );

      expect(cattleMedicationHistoryRepository.createWithManager).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          idCattle: cattleId,
          medicationName: 'M',
          dosage: '1',
          lot: 'L',
        }),
      );
    });
  });

  describe('syncCattleSimpleEvents', () => {
    const payload = (over?: Partial<SyncAnimalSimpleEventDto>): SyncAnimalSimpleEventDto => ({
      id: 'p1',
      idTenant: tenantId,
      cattleNumber: 'N-SYNC',
      type: SimpleEventType.WEIGHT,
      dataJson: JSON.stringify({ weight: 400 }),
      appliedAt: '2025-01-01T12:00:00.000Z',
      idMassiveEvent: 'me-1',
      idSimpleEvent: 'se-1',
      ...over,
    });

    it('failed si el cattle no existe', async () => {
      cattleRepository.findOneForUpdateByNumber.mockResolvedValue(null);
      const out = await service.syncCattleSimpleEvents(tenantId, userId, [payload()]);
      expect(out[0].status).toBe('failed');
      expect(out[0].message).toContain('not found');
    });

    it('failed si el status no permite aplicar eventos', async () => {
      cattleRepository.findOneForUpdateByNumber.mockResolvedValue({
        id: cattleId,
        status: CattleStatus.DEAD,
      } as Cattle);
      const out = await service.syncCattleSimpleEvents(tenantId, userId, [payload()]);
      expect(out[0].status).toBe('failed');
      expect(out[0].message).toContain('status');
    });

    it('synced con payload válido WEIGHT', async () => {
      cattleRepository.findOneForUpdateByNumber.mockResolvedValue({
        id: cattleId,
        status: CattleStatus.ACTIVE,
        number: 'N-SYNC',
      } as Cattle);
      cattleWeightHistoryRepository.findLastByCattle.mockResolvedValue(null);

      const out = await service.syncCattleSimpleEvents(tenantId, userId, [payload()]);

      expect(out[0].status).toBe('synced');
    });

    it('mezcla failed y synced en el mismo batch', async () => {
      cattleRepository.findOneForUpdateByNumber
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: cattleId,
          status: CattleStatus.ACTIVE,
          number: 'N-SYNC',
        } as Cattle);
      cattleWeightHistoryRepository.findLastByCattle.mockResolvedValue(null);

      const out = await service.syncCattleSimpleEvents(tenantId, userId, [
        payload({ id: 'f1', cattleNumber: 'NOPE' }),
        payload({ id: 'ok1', cattleNumber: 'N-SYNC' }),
      ]);

      expect(out[0].status).toBe('failed');
      expect(out[1].status).toBe('synced');
    });
  });
});

describe('CattleService.previewBirthFromDentition', () => {
  const empty = {} as never;
  let previewSvc: CattleService;

  beforeEach(() => {
    previewSvc = new CattleService(
      empty as CattleRepository,
      empty as CattleDeviceHistoryRepository,
      empty as CattleWeightHistoryRepository,
      empty as CattleEartagHistoryRepository,
      empty as CattleMedicationHistoryRepository,
      empty as CattleCharacteristicRepository,
      empty as DevicesService,
      empty as AnimalSimpleEventRepository,
      empty as DataSource,
      empty as MassiveEventService,
      empty as SimpleEventService,
      empty as SalesService,
      empty as ConfigurationsService,
      new DentitionEstimationService(),
      empty as CattleAgeHistoryRepository,
    );
  });

  it('devuelve birthDateAprx yyyy-mm-dd y versión de tabla', () => {
    const r = previewSvc.previewBirthFromDentition({
      milkTeethCount: 8,
      permanentTeethCount: 0,
      milkTeethWear: 1,
      permanentTeethWear: 0,
      dentalEvaluationDate: '2024-06-15',
    });
    expect(r.dentitionTableVersion).toBe('sapa2014-v1');
    expect(r.birthDateAprx).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
