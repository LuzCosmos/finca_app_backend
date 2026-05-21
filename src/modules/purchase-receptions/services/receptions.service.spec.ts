import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ReceptionsService } from './receptions.service';
import { PurchaseReceptionRepository } from '../repositories/purchase-reception.repository';
import { PurchaseRepository } from '../../commerce/repositories/purchase.repository';
import { MassiveEventRepository } from 'src/modules/massive-events/repositories/massive-event.repository';
import { LotRepository } from 'src/modules/commerce/repositories/lot.repository';
import { CattleService } from 'src/modules/farm/services/cattle.service';
import { CattleRepository } from 'src/modules/farm/repositories/cattle.repository';
import { AnimalSimpleEventRepository } from 'src/modules/massive-events/repositories/animal-simple-event.repository';
import { SimpleEventRepository } from 'src/modules/massive-events/repositories/simple-event.repository';
import { BusinessPartnerRepository } from '../../commerce/repositories/business-partner.repository';
import { ConfigurationsService } from 'src/modules/configurations/services/configurations.service';
import { CattleWeightHistoryRepository } from '../../farm/repositories/cattle-weight-history.repository';
import { CattleCharacteristicRepository } from '../../farm/repositories/cattle-characteristic.repository';
import { CattleDeviceHistoryRepository } from '../../farm/repositories/cattle-device-history.repository';
import { DevicesService } from 'src/modules/production-center/services/devices.service';
import { ColorCharacteristicsService } from '../../farm/services/color-characteristics.service';
import { LotService } from 'src/modules/commerce/services/lot.service';
import { Device } from 'src/modules/production-center/entities/device.entity';
import { MassiveEvent } from 'src/modules/massive-events/entities/massive-events.entity';
import {
  ReceiveCattleRequestDto,
  UpdateLotCattleRequestDto,
  UpdateReceivedCattleDto,
} from '../dto/receive-cattle-request.dto';
import { BirthDateAprxSource } from '../../farm/enums/birth-date-aprx-source.enum';
import { CattleGender } from '../../farm/enums/cattle-gender.enum';
import { Cattle, CattleStatus } from '../../farm/entities/cattle.entity';
import { Lot } from 'src/modules/commerce/entities/lot.entity';
import { WeightContext } from '../../farm/entities/cattle-weight-history.entity';
import { SimpleEventType } from 'src/modules/massive-events/enums/simple-event-type.enum';

describe('ReceptionsService', () => {
  let service: ReceptionsService;
  let dataSource: { transaction: jest.Mock };
  let mockManager: { save: jest.Mock };

  let deviceRepo: { find: jest.Mock };
  let prRepo: { findByPurchase: jest.Mock; createInstance: jest.Mock };
  let purchaseRepo: { findById: jest.Mock };
  let massiveEventRepo: { createInstance: jest.Mock; saveWithManager: jest.Mock; findById: jest.Mock };
  let lotRepo: { findByPurchaseId: jest.Mock; findById: jest.Mock };
  let cattleRepo: {
    findByPurchaseId?: jest.Mock;
    findByIdLot: jest.Mock;
    findByIdPurchaseWithoutLot: jest.Mock;
    findByNumberAndTenantId: jest.Mock;
    saveWithManager: jest.Mock;
    findByAnyEartag: jest.Mock;
    unsetDevice: jest.Mock;
    getSuggestNextNumber: jest.Mock;
    findById: jest.Mock;
  };
  let animalSimpleEventRepo: { findByCattle: jest.Mock };
  let simpleEventRepo: { findByMassiveEvent: jest.Mock; findByIds: jest.Mock };
  let businessPartnerRepo: { findById: jest.Mock };
  let configurationsService: { getTenantConfiguration: jest.Mock; updateTenantConfiguration: jest.Mock };
  let cattleWeightHistoryRepo: { createWithManager: jest.Mock };
  let cattleCharacteristicRepository: { attachMany: jest.Mock; replaceAll: jest.Mock };
  let cattleDeviceHistoryRepository: {
    unassignDeviceByidDevice: jest.Mock;
    assignDeviceToCattle: jest.Mock;
  };
  let deviceService: { findById: jest.Mock; updateWithDevice: jest.Mock };
  let lotService: { UpdateLotDataAfterReception: jest.Mock };
  let cattleService: {
    applyMultipleSimpleEventsByNumber_manager: jest.Mock;
    mergeReceiveCattleBirthAndDentition: jest.Mock;
    recordAgeHistoryFromSavedCattle: jest.Mock;
    findByAnyEartag: jest.Mock;
  };

  const tenantId = 'tenant-1';
  const purchaseId = 'purchase-1';
  const userId = 'user-1';

  const colorCharacteristicsStub = {} as ColorCharacteristicsService;

  function buildService() {
    dataSource = {
      transaction: jest.fn(async (cb: (m: EntityManager) => Promise<unknown>) =>
        cb(mockManager as unknown as EntityManager),
      ),
    };
    return new ReceptionsService(
      dataSource as unknown as DataSource,
      prRepo as unknown as PurchaseReceptionRepository,
      purchaseRepo as unknown as PurchaseRepository,
      massiveEventRepo as unknown as MassiveEventRepository,
      lotRepo as unknown as LotRepository,
      cattleService as unknown as CattleService,
      cattleRepo as unknown as CattleRepository,
      animalSimpleEventRepo as unknown as AnimalSimpleEventRepository,
      simpleEventRepo as unknown as SimpleEventRepository,
      businessPartnerRepo as unknown as BusinessPartnerRepository,
      configurationsService as unknown as ConfigurationsService,
      cattleWeightHistoryRepo as unknown as CattleWeightHistoryRepository,
      cattleCharacteristicRepository as unknown as CattleCharacteristicRepository,
      cattleDeviceHistoryRepository as unknown as CattleDeviceHistoryRepository,
      deviceService as unknown as DevicesService,
      colorCharacteristicsStub,
      lotService as unknown as LotService,
      deviceRepo as unknown as Repository<Device>,
    );
  }

  beforeEach(() => {
    mockManager = { save: jest.fn() };
    deviceRepo = { find: jest.fn() };
    prRepo = { findByPurchase: jest.fn(), createInstance: jest.fn() };
    purchaseRepo = { findById: jest.fn() };
    massiveEventRepo = {
      createInstance: jest.fn((data: Partial<MassiveEvent>) => ({ ...data } as MassiveEvent)),
      saveWithManager: jest.fn(),
      findById: jest.fn(),
    };
    lotRepo = { findByPurchaseId: jest.fn(), findById: jest.fn() };
    cattleRepo = {
      findByIdLot: jest.fn(),
      findByIdPurchaseWithoutLot: jest.fn(),
      findByNumberAndTenantId: jest.fn(),
      saveWithManager: jest.fn(),
      findByAnyEartag: jest.fn(),
      unsetDevice: jest.fn(),
      getSuggestNextNumber: jest.fn(),
      findById: jest.fn(),
    };
    animalSimpleEventRepo = { findByCattle: jest.fn() };
    simpleEventRepo = { findByMassiveEvent: jest.fn(), findByIds: jest.fn() };
    businessPartnerRepo = { findById: jest.fn() };
    configurationsService = {
      getTenantConfiguration: jest.fn(),
      updateTenantConfiguration: jest.fn(),
    };
    cattleWeightHistoryRepo = { createWithManager: jest.fn() };
    cattleCharacteristicRepository = { attachMany: jest.fn(), replaceAll: jest.fn() };
    cattleDeviceHistoryRepository = {
      unassignDeviceByidDevice: jest.fn(),
      assignDeviceToCattle: jest.fn(),
    };
    deviceService = { findById: jest.fn(), updateWithDevice: jest.fn() };
    lotService = { UpdateLotDataAfterReception: jest.fn() };
    cattleService = {
      applyMultipleSimpleEventsByNumber_manager: jest.fn(),
      mergeReceiveCattleBirthAndDentition: jest.fn().mockReturnValue({}),
      recordAgeHistoryFromSavedCattle: jest.fn().mockResolvedValue(undefined),
      findByAnyEartag: jest.fn().mockResolvedValue(null),
    };

    service = buildService();
  });

  describe('searchDevices', () => {
    it('delega en deviceRepo.find con condiciones ILike', async () => {
      const q = 'abc';
      const devices = [{ id: 'd1', idTenant: tenantId }] as Device[];
      deviceRepo.find.mockResolvedValue(devices);

      const out = await service.searchDevices(tenantId, q);

      expect(out).toBe(devices);
      expect(deviceRepo.find).toHaveBeenCalledWith({
        take: 20,
        where: [
          { idTenant: tenantId, name: expect.objectContaining({ _type: 'ilike', _value: `%${q}%` }) },
          { idTenant: tenantId, deveui: expect.objectContaining({ _type: 'ilike', _value: `%${q}%` }) },
        ],
      });
    });

    it('con query vacío sigue llamando find (comportamiento actual)', async () => {
      deviceRepo.find.mockResolvedValue([]);
      await service.searchDevices(tenantId, '');
      expect(deviceRepo.find).toHaveBeenCalled();
    });

    it('con query solo espacios sigue llamando find', async () => {
      deviceRepo.find.mockResolvedValue([]);
      await service.searchDevices(tenantId, '   ');
      expect(deviceRepo.find).toHaveBeenCalled();
    });

    it('propaga errores de deviceRepo.find', async () => {
      deviceRepo.find.mockRejectedValue(new Error('db error'));
      await expect(service.searchDevices(tenantId, 'x')).rejects.toThrow('db error');
    });
  });

  describe('getSimpleReception', () => {
    it('delega en prRepo.findByPurchase con tenant, purchase y manager', async () => {
      const manager = {} as EntityManager;
      const reception = { id: 'rec-1' };
      prRepo.findByPurchase.mockResolvedValue(reception);

      const out = await service.getSimpleReception(tenantId, 'purchase-1', manager);

      expect(out).toBe(reception);
      expect(prRepo.findByPurchase).toHaveBeenCalledWith(tenantId, 'purchase-1', manager);
    });
  });

  describe('findOrCreateReceptionByIdPurchase', () => {
    it('lanza NotFoundException si la compra no existe', async () => {
      purchaseRepo.findById.mockResolvedValue(null);
      await expect(service.findOrCreateReceptionByIdPurchase(tenantId, purchaseId, userId)).rejects.toThrow(
        new NotFoundException('Purchase not found'),
      );
    });

    it('crea recepción y massive event cuando no existen', async () => {
      const purchase = {
        id: purchaseId,
        idProvider: 'prov-1',
        purchaseDate: new Date('2025-01-15'),
        status: 'OPEN',
      };
      purchaseRepo.findById.mockResolvedValue(purchase);
      prRepo.findByPurchase.mockResolvedValueOnce(null);
      massiveEventRepo.saveWithManager.mockImplementation(async (_m, ev: MassiveEvent) => ({
        ...ev,
        simpleEvents: [],
      }));
      prRepo.createInstance.mockImplementation(async (payload: { idMassiveEvent: string }) => ({
        id: 'rec-new',
        idTenant: tenantId,
        idPurchase: purchaseId,
        idMassiveEvent: payload.idMassiveEvent,
        receivedAt: new Date('2025-06-02'),
        nextCattleNumber: null,
      }));
      businessPartnerRepo.findById.mockResolvedValue({ name: 'Provider SA' });
      lotRepo.findByPurchaseId.mockResolvedValue([]);
      cattleRepo.findByIdLot.mockResolvedValue([]);
      cattleRepo.findByIdPurchaseWithoutLot.mockResolvedValue([]);
      animalSimpleEventRepo.findByCattle.mockResolvedValue([]);

      await service.findOrCreateReceptionByIdPurchase(tenantId, purchaseId, userId);

      expect(massiveEventRepo.saveWithManager).toHaveBeenCalled();
      expect(prRepo.createInstance).toHaveBeenCalled();
    });

    it('reutiliza recepción existente sin crear massive event nuevo', async () => {
      const purchase = {
        id: purchaseId,
        idProvider: 'prov-1',
        purchaseDate: new Date('2025-01-15'),
        status: 'OPEN',
      };
      const reception = {
        id: 'rec-1',
        idPurchase: purchaseId,
        idMassiveEvent: 'me-1',
        receivedAt: new Date('2025-06-01'),
      };
      const massive = { id: 'me-1', status: 'open', simpleEvents: [] } as unknown as MassiveEvent;
      purchaseRepo.findById.mockResolvedValue(purchase);
      prRepo.findByPurchase.mockResolvedValue(reception);
      massiveEventRepo.findById.mockResolvedValue(massive);
      simpleEventRepo.findByMassiveEvent.mockResolvedValue([]);
      businessPartnerRepo.findById.mockResolvedValue({ name: 'P' });
      lotRepo.findByPurchaseId.mockResolvedValue([]);
      cattleRepo.findByIdLot.mockResolvedValue([]);
      cattleRepo.findByIdPurchaseWithoutLot.mockResolvedValue([]);

      await service.findOrCreateReceptionByIdPurchase(tenantId, purchaseId, userId);

      expect(massiveEventRepo.saveWithManager).not.toHaveBeenCalled();
      expect(massiveEventRepo.findById).toHaveBeenCalledWith(tenantId, 'me-1', expect.anything());
    });

    it('lanza NotFoundException si el proveedor no existe', async () => {
      const purchase = {
        id: purchaseId,
        idProvider: 'prov-missing',
        purchaseDate: new Date('2025-01-15'),
        status: 'OPEN',
      };
      const reception = {
        id: 'rec-1',
        idPurchase: purchaseId,
        idMassiveEvent: 'me-1',
        receivedAt: new Date('2025-06-01'),
      };
      const massive = { id: 'me-1', status: 'open', simpleEvents: [] } as unknown as MassiveEvent;
      purchaseRepo.findById.mockResolvedValue(purchase);
      prRepo.findByPurchase.mockResolvedValue(reception);
      massiveEventRepo.findById.mockResolvedValue(massive);
      simpleEventRepo.findByMassiveEvent.mockResolvedValue([]);
      businessPartnerRepo.findById.mockResolvedValue(null);

      await expect(service.findOrCreateReceptionByIdPurchase(tenantId, purchaseId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('nextNumber', () => {
    it('ejecuta transacción y delega en getSuggestNextNumber', async () => {
      cattleRepo.getSuggestNextNumber.mockResolvedValue('N-99');
      const out = await service.nextNumber(tenantId, 'N-1');
      expect(out).toBe('N-99');
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(cattleRepo.getSuggestNextNumber).toHaveBeenCalledWith(tenantId, 'N-1', mockManager);
    });

    it('propaga error del repositorio', async () => {
      cattleRepo.getSuggestNextNumber.mockRejectedValue(new Error('lock'));
      await expect(service.nextNumber(tenantId, 'N')).rejects.toThrow('lock');
    });
  });

  describe('assignLotCattle', () => {
    it('lanza NotFoundException si el cattle no existe', async () => {
      cattleRepo.findById.mockResolvedValue(null);
      const dto: UpdateLotCattleRequestDto = { idCattle: 'c1', idLot: 'l1' };
      await expect(service.assignLotCattle(tenantId, dto)).rejects.toThrow(
        new NotFoundException('Cattle not found'),
      );
    });

    it('lanza NotFoundException si el lote destino no existe', async () => {
      cattleRepo.findById.mockResolvedValue({ id: 'c1', idLot: null } as Cattle);
      lotRepo.findById.mockResolvedValueOnce(null);
      const dto: UpdateLotCattleRequestDto = { idCattle: 'c1', idLot: 'l-missing' };
      await expect(service.assignLotCattle(tenantId, dto)).rejects.toThrow(new NotFoundException('Lot not found'));
    });

    it('actualiza cattle y lotes sin lote previo', async () => {
      const lot = { id: 'l2', averageWeight: 400, pricePerKg: 2 } as Lot;
      const cattle = { id: 'c1', idLot: null, purchaseWeight: 0, purchasePrice: 0 } as Cattle;
      cattleRepo.findById.mockResolvedValue(cattle);
      lotRepo.findById.mockResolvedValue(lot);
      cattleRepo.saveWithManager.mockImplementation(async (_m, c) => c);

      const dto: UpdateLotCattleRequestDto = { idCattle: 'c1', idLot: 'l2' };
      await service.assignLotCattle(tenantId, dto);

      expect(cattleRepo.saveWithManager).toHaveBeenCalled();
      expect(lotService.UpdateLotDataAfterReception).toHaveBeenCalledWith(tenantId, 'l2', mockManager);
    });

    it('con lote previo actualiza también el lote de origen', async () => {
      const oldLot = { id: 'l-old', averageWeight: 350, pricePerKg: 2 } as Lot;
      const newLot = { id: 'l2', averageWeight: 400, pricePerKg: 3 } as Lot;
      const cattle = { id: 'c1', idLot: 'l-old', purchaseWeight: 0, purchasePrice: 0 } as Cattle;
      cattleRepo.findById.mockResolvedValue(cattle);
      lotRepo.findById.mockResolvedValueOnce(oldLot).mockResolvedValueOnce(newLot);
      cattleRepo.saveWithManager.mockImplementation(async (_m, c) => c);

      await service.assignLotCattle(tenantId, { idCattle: 'c1', idLot: 'l2' });

      expect(lotService.UpdateLotDataAfterReception).toHaveBeenCalledWith(tenantId, 'l2', mockManager);
      expect(lotService.UpdateLotDataAfterReception).toHaveBeenCalledWith(tenantId, 'l-old', mockManager);
    });

    it('usa 0 en peso y precio cuando el lote tiene averageWeight o pricePerKg nulos', async () => {
      const lot = { id: 'l2', averageWeight: null, pricePerKg: null } as unknown as Lot;
      const cattle = { id: 'c1', idLot: null, purchaseWeight: 0, purchasePrice: 0 } as Cattle;
      cattleRepo.findById.mockResolvedValue(cattle);
      lotRepo.findById.mockResolvedValue(lot);
      cattleRepo.saveWithManager.mockImplementation(async (_m, c) => c);

      await service.assignLotCattle(tenantId, { idCattle: 'c1', idLot: 'l2' });

      expect(cattleRepo.saveWithManager).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ purchaseWeight: 0, purchasePrice: 0 }),
      );
    });
  });

  describe('receiveCattle_Transaction', () => {
    const baseDto = (): ReceiveCattleRequestDto => ({
      idPurchase: purchaseId,
      number: 'C-NEW',
      receivedWeight: 350,
      color: 'brown',
      hasHorn: false,
      castrated: false,
    });

    beforeEach(() => {
      configurationsService.getTenantConfiguration.mockResolvedValue({ value: '10' });
      configurationsService.updateTenantConfiguration.mockResolvedValue(undefined);
      cattleRepo.findByAnyEartag.mockResolvedValue(null);
      prRepo.findByPurchase.mockResolvedValue(null);
    });

    it('lanza ConflictException si ya existe cattle ACTIVE con el mismo número', async () => {
      cattleRepo.findByNumberAndTenantId.mockResolvedValue({
        id: 'x',
        status: CattleStatus.ACTIVE,
      } as Cattle);
      await expect(service.receiveCattle_Transaction(tenantId, userId, baseDto())).rejects.toThrow(ConflictException);
    });

    it('lanza ConflictException si eartagLeft está duplicado', async () => {
      cattleRepo.findByNumberAndTenantId.mockResolvedValue(null);
      const dto = { ...baseDto(), eartagLeft: 'E-1' };
      cattleRepo.findByAnyEartag.mockResolvedValueOnce({ id: 'other' } as Cattle);
      await expect(service.receiveCattle_Transaction(tenantId, userId, dto)).rejects.toThrow(/Eartag E-1/);
    });

    it('lanza NotFoundException si idLot no existe', async () => {
      cattleRepo.findByNumberAndTenantId.mockResolvedValue(null);
      lotRepo.findById.mockResolvedValue(null);
      const dto = { ...baseDto(), idLot: 'lot-x' };
      await expect(service.receiveCattle_Transaction(tenantId, userId, dto)).rejects.toThrow(
        new NotFoundException('Lot not found lot-x'),
      );
    });

    it('crea cattle, historial RECEIVED y delega en lote cuando aplica', async () => {
      cattleRepo.findByNumberAndTenantId.mockResolvedValue(null);
      const lot = { id: 'lot-1', averageWeight: 300, pricePerKg: 3 } as Lot;
      lotRepo.findById.mockResolvedValue(lot);
      const savedCattle = { id: 'new-c', number: 'C-NEW' } as Cattle;
      cattleRepo.saveWithManager.mockResolvedValue(savedCattle);

      const dto = { ...baseDto(), idLot: 'lot-1' };
      await service.receiveCattle_Transaction(tenantId, userId, dto);

      expect(cattleRepo.saveWithManager).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          idTenant: tenantId,
          number: 'C-NEW',
          sysNumber: 10,
          status: CattleStatus.ACTIVE,
          receivedWeight: 350,
          lastWeight: 350,
          idLot: 'lot-1',
        }),
      );
      expect(cattleWeightHistoryRepo.createWithManager).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          idTenant: tenantId,
          idCattle: 'new-c',
          weight: 350,
          context: WeightContext.RECEIVED,
          recordedBy: userId,
        }),
      );
      expect(lotService.UpdateLotDataAfterReception).toHaveBeenCalledWith(tenantId, 'lot-1', mockManager);
    });

    it('lanza NotFoundException si idDevice no existe', async () => {
      cattleRepo.findByNumberAndTenantId.mockResolvedValue(null);
      cattleRepo.saveWithManager.mockResolvedValue({ id: 'c1', number: 'C-NEW' } as Cattle);
      deviceService.findById.mockResolvedValue(null);
      const dto = { ...baseDto(), idDevice: 'dev-missing' };
      await expect(service.receiveCattle_Transaction(tenantId, userId, dto)).rejects.toThrow(
        new NotFoundException('Device dev-missing not found'),
      );
    });

    it('lanza NotFoundException si falta configuración next_cattle_sysnumber', async () => {
      configurationsService.getTenantConfiguration.mockResolvedValue(null);
      cattleRepo.findByNumberAndTenantId.mockResolvedValue(null);
      await expect(service.receiveCattle_Transaction(tenantId, userId, baseDto())).rejects.toThrow(
        new NotFoundException('Configuration next_cattle_sysnumber not found'),
      );
    });

    it('asocia dispositivo y etiquetas cuando idDevice existe', async () => {
      cattleRepo.findByNumberAndTenantId.mockResolvedValue(null);
      const savedCattle = { id: 'c-device', number: 'C-NEW' } as Cattle;
      cattleRepo.saveWithManager.mockResolvedValue(savedCattle);
      const device = { id: 'dev-1', tags: {} as Record<string, string> };
      deviceService.findById.mockResolvedValue(device as never);
      deviceService.updateWithDevice.mockResolvedValue(device as never);

      const dto = { ...baseDto(), idDevice: 'dev-1' };
      await service.receiveCattle_Transaction(tenantId, userId, dto);

      expect(deviceService.updateWithDevice).toHaveBeenCalled();
      expect(cattleDeviceHistoryRepository.assignDeviceToCattle).toHaveBeenCalledWith(
        'dev-1',
        'c-device',
        tenantId,
        userId,
        expect.any(Date),
        undefined,
        mockManager,
      );
    });

    it('excluye simple events WEIGHT al armar applyMultiple y mantiene otros tipos', async () => {
      cattleRepo.findByNumberAndTenantId.mockResolvedValue(null);
      const savedCattle = { id: 'c1', number: 'C-NEW' } as Cattle;
      cattleRepo.saveWithManager.mockResolvedValue(savedCattle);
      simpleEventRepo.findByIds.mockResolvedValue([
        { id: 'se-w', idMassiveEvent: 'me-1', type: SimpleEventType.WEIGHT, data: { weight: 400 } },
        {
          id: 'se-m',
          idMassiveEvent: 'me-1',
          type: SimpleEventType.MEDICATION,
          data: { medicationName: 'M', dosage: '1', lot: 'L' },
        },
      ] as never);
      cattleService.applyMultipleSimpleEventsByNumber_manager.mockResolvedValue([]);

      const dto = {
        ...baseDto(),
        idSimpleEvents: ['se-w', 'se-m'],
      };
      await service.receiveCattle_Transaction(tenantId, userId, dto);

      expect(cattleService.applyMultipleSimpleEventsByNumber_manager).toHaveBeenCalledWith(
        tenantId,
        userId,
        'C-NEW',
        'me-1',
        expect.arrayContaining([
          expect.objectContaining({ type: SimpleEventType.MEDICATION, idSimpleEvent: 'se-m' }),
        ]),
        mockManager,
        savedCattle,
      );
      expect(cattleService.applyMultipleSimpleEventsByNumber_manager).toHaveBeenCalledWith(
        tenantId,
        userId,
        'C-NEW',
        'me-1',
        expect.not.arrayContaining([expect.objectContaining({ type: SimpleEventType.WEIGHT })]),
        mockManager,
        savedCattle,
      );
    });
  });

  describe('updateReceivedCattle', () => {
    const cattleId = 'cattle-1';
    const baseCattle = (): Cattle =>
      ({
        id: cattleId,
        idTenant: tenantId,
        idPurchase: purchaseId,
        idLot: 'lot-old',
        receivedWeight: 300,
        lastWeight: 300,
        purchaseWeight: 280,
        purchasePrice: 560,
        eartagLeft: 'L-1',
        eartagRight: 'R-1',
        hasHorn: false,
        castrated: false,
        gender: CattleGender.MALE,
        color: 'BLACK',
        comments: 'orig',
        idDevice: null,
        birthDateAprx: null,
        birthDateAprxSource: null,
        milkTeethCount: null,
        permanentTeethCount: null,
        milkTeethWear: null,
        permanentTeethWear: null,
        dentalEvaluationDate: null,
        dentitionTableVersion: null,
      }) as Cattle;

    beforeEach(() => {
      purchaseRepo.findById.mockResolvedValue({ id: purchaseId });
      cattleRepo.saveWithManager.mockImplementation(async (_m, c) => c);
    });

    it('lanza NotFoundException si el cattle no existe', async () => {
      cattleRepo.findById.mockResolvedValue(null);
      await expect(
        service.updateReceivedCattle(tenantId, cattleId, { receivedWeight: 400 }, userId),
      ).rejects.toThrow(new NotFoundException('Cattle not found'));
    });

    it('lanza ConflictException si no está vinculado a compra', async () => {
      cattleRepo.findById.mockResolvedValue({
        ...baseCattle(),
        idPurchase: null,
      } as unknown as Cattle);
      await expect(
        service.updateReceivedCattle(tenantId, cattleId, { receivedWeight: 400 }, userId),
      ).rejects.toThrow(
        new ConflictException('Animal is not linked to a purchase reception'),
      );
    });

    it('lanza NotFoundException si la compra no existe', async () => {
      cattleRepo.findById.mockResolvedValue(baseCattle());
      purchaseRepo.findById.mockResolvedValue(null);
      await expect(
        service.updateReceivedCattle(tenantId, cattleId, { receivedWeight: 400 }, userId),
      ).rejects.toThrow(new NotFoundException('Purchase not found'));
    });

    it('flujo feliz: actualiza peso, flags, género, color y comentarios', async () => {
      const cattle = baseCattle();
      cattleRepo.findById.mockResolvedValue(cattle);
      const dto: UpdateReceivedCattleDto = {
        receivedWeight: 410,
        hasHorn: true,
        castrated: true,
        gender: CattleGender.FEMALE,
        color: 'WHITE',
        comments: '  corregido  ',
      };

      const saved = await service.updateReceivedCattle(tenantId, cattleId, dto, userId);

      expect(saved.receivedWeight).toBe(410);
      expect(saved.lastWeight).toBe(410);
      expect(saved.hasHorn).toBe(true);
      expect(saved.castrated).toBe(true);
      expect(saved.gender).toBe(CattleGender.FEMALE);
      expect(saved.color).toBe('WHITE');
      expect(saved.comments).toBe('corregido');
      expect(cattleRepo.saveWithManager).toHaveBeenCalled();
    });

    it('reemplaza características cuando se envían', async () => {
      cattleRepo.findById.mockResolvedValue(baseCattle());
      await service.updateReceivedCattle(
        tenantId,
        cattleId,
        { characteristics: ['SPOTTED', 'BELLY_WHITE'] },
        userId,
      );
      expect(cattleCharacteristicRepository.replaceAll).toHaveBeenCalledWith(
        cattleId,
        tenantId,
        ['SPOTTED', 'BELLY_WHITE'],
        mockManager,
      );
    });

    it('asigna dispositivo y desasigna de otros cattle', async () => {
      cattleRepo.findById.mockResolvedValue(baseCattle());
      await service.updateReceivedCattle(
        tenantId,
        cattleId,
        { idDevice: 'dev-9' },
        userId,
      );
      expect(cattleDeviceHistoryRepository.unassignDeviceByidDevice).toHaveBeenCalled();
      expect(cattleRepo.unsetDevice).toHaveBeenCalledWith(tenantId, 'dev-9', mockManager);
      expect(cattleRepo.saveWithManager).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ idDevice: 'dev-9' }),
      );
    });

    it('permite quitar dispositivo con idDevice null', async () => {
      const cattle = { ...baseCattle(), idDevice: 'dev-old' } as Cattle;
      cattleRepo.findById.mockResolvedValue(cattle);
      await service.updateReceivedCattle(tenantId, cattleId, { idDevice: null }, userId);
      expect(cattleDeviceHistoryRepository.unassignDeviceByidDevice).not.toHaveBeenCalled();
      expect(cattleRepo.saveWithManager).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ idDevice: null }),
      );
    });

    it('lanza BadRequestException si el lote no pertenece a la compra', async () => {
      cattleRepo.findById.mockResolvedValue(baseCattle());
      lotRepo.findById.mockResolvedValue({
        id: 'lot-x',
        idPurchase: 'other-purchase',
      } as Lot);
      await expect(
        service.updateReceivedCattle(
          tenantId,
          cattleId,
          { idLot: 'lot-x' },
          userId,
        ),
      ).rejects.toThrow(new BadRequestException('Lot does not belong to this purchase'));
    });

    it('cambia de lote y recalcula lote nuevo y anterior', async () => {
      cattleRepo.findById.mockResolvedValue(baseCattle());
      lotRepo.findById.mockResolvedValue({
        id: 'lot-new',
        idPurchase: purchaseId,
        averageWeight: 390,
        pricePerKg: 2.5,
      } as Lot);

      await service.updateReceivedCattle(
        tenantId,
        cattleId,
        { idLot: 'lot-new' },
        userId,
      );

      expect(lotService.UpdateLotDataAfterReception).toHaveBeenCalledWith(
        tenantId,
        'lot-new',
        mockManager,
      );
      expect(lotService.UpdateLotDataAfterReception).toHaveBeenCalledWith(
        tenantId,
        'lot-old',
        mockManager,
      );
    });

    it('permite dejar la res sin lote (idLot null)', async () => {
      cattleRepo.findById.mockResolvedValue(baseCattle());
      await service.updateReceivedCattle(tenantId, cattleId, { idLot: null }, userId);
      expect(cattleRepo.saveWithManager).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ idLot: null }),
      );
      expect(lotService.UpdateLotDataAfterReception).toHaveBeenCalledWith(
        tenantId,
        'lot-old',
        mockManager,
      );
    });

    it('recalcula lote actual al cambiar solo peso', async () => {
      cattleRepo.findById.mockResolvedValue(baseCattle());
      await service.updateReceivedCattle(
        tenantId,
        cattleId,
        { receivedWeight: 320 },
        userId,
      );
      expect(lotService.UpdateLotDataAfterReception).toHaveBeenCalledWith(
        tenantId,
        'lot-old',
        mockManager,
      );
    });

    it('lanza ConflictException si arete pertenece a otra res activa', async () => {
      cattleRepo.findById.mockResolvedValue(baseCattle());
      cattleService.findByAnyEartag.mockResolvedValue({
        id: 'other-cattle',
        status: CattleStatus.ACTIVE,
      } as Cattle);
      await expect(
        service.updateReceivedCattle(
          tenantId,
          cattleId,
          { eartagLeft: 'DUPE-1' },
          userId,
        ),
      ).rejects.toThrow(/Eartag DUPE-1/);
    });

    it('permite conservar el mismo arete de la res actual', async () => {
      const cattle = baseCattle();
      cattleRepo.findById.mockResolvedValue(cattle);
      cattleService.findByAnyEartag.mockResolvedValue(cattle);
      await service.updateReceivedCattle(
        tenantId,
        cattleId,
        { eartagLeft: 'L-1' },
        userId,
      );
      expect(cattleRepo.saveWithManager).toHaveBeenCalled();
    });

    it('limpia arete vacío a null', async () => {
      cattleRepo.findById.mockResolvedValue(baseCattle());
      await service.updateReceivedCattle(
        tenantId,
        cattleId,
        { eartagLeft: '   ' },
        userId,
      );
      expect(cattleRepo.saveWithManager).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ eartagLeft: null }),
      );
    });

    it('aplica dentición completa vía mergeReceiveCattleBirthAndDentition', async () => {
      cattleRepo.findById.mockResolvedValue(baseCattle());
      const patch = {
        birthDateAprx: new Date('2020-01-01'),
        birthDateAprxSource: BirthDateAprxSource.DENTITION,
        milkTeethCount: 4,
        permanentTeethCount: 0,
        milkTeethWear: 2,
        permanentTeethWear: 0,
        dentalEvaluationDate: new Date('2025-01-10'),
        dentitionTableVersion: 'sapa2014-v1',
      };
      cattleService.mergeReceiveCattleBirthAndDentition.mockReturnValue(patch);

      await service.updateReceivedCattle(
        tenantId,
        cattleId,
        {
          milkTeethCount: 4,
          permanentTeethCount: 0,
          milkTeethWear: 2,
          permanentTeethWear: 0,
          dentalEvaluationDate: '2025-01-10',
        },
        userId,
      );

      expect(cattleService.mergeReceiveCattleBirthAndDentition).toHaveBeenCalled();
      expect(cattleService.recordAgeHistoryFromSavedCattle).toHaveBeenCalled();
      expect(cattleRepo.saveWithManager).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining(patch),
      );
    });

    it('fecha manual limpia campos de dentición', async () => {
      const cattle = {
        ...baseCattle(),
        milkTeethCount: 4,
        permanentTeethCount: 0,
      } as Cattle;
      cattleRepo.findById.mockResolvedValue(cattle);

      await service.updateReceivedCattle(
        tenantId,
        cattleId,
        { birthDateAprx: '2019-06-01' },
        userId,
      );

      expect(cattleRepo.saveWithManager).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          birthDateAprx: new Date('2019-06-01'),
          birthDateAprxSource: BirthDateAprxSource.MANUAL,
          milkTeethCount: null,
          permanentTeethCount: null,
        }),
      );
    });

    it('birthDateAprx null limpia edad y dentición', async () => {
      cattleRepo.findById.mockResolvedValue({
        ...baseCattle(),
        birthDateAprx: new Date('2018-01-01'),
        milkTeethCount: 2,
      } as Cattle);

      await service.updateReceivedCattle(
        tenantId,
        cattleId,
        { birthDateAprx: null },
        userId,
      );

      expect(cattleRepo.saveWithManager).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          birthDateAprx: null,
          birthDateAprxSource: null,
          milkTeethCount: null,
        }),
      );
    });
  });
});
