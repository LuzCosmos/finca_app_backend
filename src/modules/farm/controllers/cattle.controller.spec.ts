import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CattleController } from './cattle.controller';
import { CattleService } from '../services/cattle.service';
import { AnimalSimpleEventRepository } from 'src/modules/massive-events/repositories/animal-simple-event.repository';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { Cattle, CattleStatus } from '../entities/cattle.entity';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';
import { CreateCattleMedicationHistoryDto } from '../dto/create-cattle-medication-history.dto';
import { CattleListQueryDto } from '../dto/cattle-list.query.dto';
import { CattleBasicQueryDto } from '../dto/cattle-basic-query.dto';
import { PagedResponseDto } from 'src/shared/dto/paged-response.dto';
import { SimpleEventType } from 'src/modules/massive-events/enums/simple-event-type.enum';
import { ApplySimpleEventsDto } from 'src/modules/massive-events/dto/apply-simple-events.dto';

describe('CattleController', () => {
  let controller: CattleController;
  let cattleService: {
    findByIdOrFail: jest.Mock;
    search: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    addMedicationHistory: jest.Mock;
    remove: jest.Mock;
    listPaged: jest.Mock;
    getBasicInfo: jest.Mock;
    getBasicInfoPaged: jest.Mock;
    applyMultipleSimpleEventsByNumber_transaction: jest.Mock;
    applyBulkSimpleEvents: jest.Mock;
    syncCattleSimpleEvents: jest.Mock;
    import: jest.Mock;
    validateCattleByNumber: jest.Mock;
    recordWeightHistory: jest.Mock;
    updateCattleWeight: jest.Mock;
    bulkUpdateStatus: jest.Mock;
  };
  let animalSimpleEventRepository: {
    findByCattle: jest.Mock;
  };

  const session: SessionUserDto = {
    username: 'alice',
    sub: 'user-1',
    tenant_id: 'tenant-1',
    date: '2025-01-01',
    permissionsHash: 'h',
    permissions: {},
    sessionId: 'sess-1',
  };

  beforeEach(async () => {
    cattleService = {
      findByIdOrFail: jest.fn(),
      search: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      addMedicationHistory: jest.fn(),
      remove: jest.fn(),
      listPaged: jest.fn(),
      getBasicInfo: jest.fn(),
      getBasicInfoPaged: jest.fn(),
      applyMultipleSimpleEventsByNumber_transaction: jest.fn(),
      applyBulkSimpleEvents: jest.fn(),
      syncCattleSimpleEvents: jest.fn(),
      import: jest.fn(),
      validateCattleByNumber: jest.fn(),
      recordWeightHistory: jest.fn(),
      updateCattleWeight: jest.fn(),
      bulkUpdateStatus: jest.fn(),
    };
    animalSimpleEventRepository = {
      findByCattle: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CattleController],
      providers: [
        { provide: CattleService, useValue: cattleService },
        { provide: AnimalSimpleEventRepository, useValue: animalSimpleEventRepository },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ApplicationPermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CattleController>(CattleController);
  });

  describe('findOne', () => {
    it('delega en cattleService.findByIdOrFail con tenant e id', async () => {
      const row = { id: 'c1', idTenant: 'tenant-1' } as Cattle;
      cattleService.findByIdOrFail.mockResolvedValue(row);

      const out = await controller.findOne('c1', session);

      expect(cattleService.findByIdOrFail).toHaveBeenCalledWith('tenant-1', 'c1');
      expect(out).toBe(row);
    });
  });

  describe('search', () => {
    it('delega en cattleService.search con tenant y query', async () => {
      const rows: Cattle[] = [];
      cattleService.search.mockResolvedValue(rows);

      const out = await controller.search(session, 'q123');

      expect(cattleService.search).toHaveBeenCalledWith('tenant-1', 'q123');
      expect(out).toBe(rows);
    });
  });

  describe('create', () => {
    it('delega en cattleService.create con tenant, dto y sub', async () => {
      const created = { id: 'new', number: 'N-1', status: CattleStatus.ACTIVE } as Cattle;
      cattleService.create.mockResolvedValue(created);
      const dto: CreateCattleDto = {
        sysNumber: '1',
        number: 'N-1',
        receivedAt: '2025-01-01',
        receivedWeight: 100,
        purchaseWeight: 100,
        purchasePrice: 100,
      } as CreateCattleDto;

      const out = await controller.create(session, dto);

      expect(cattleService.create).toHaveBeenCalledWith('tenant-1', dto, 'user-1');
      expect(out).toBe(created);
    });

    it('propaga errores de cattleService.create', async () => {
      const dto = {
        sysNumber: '1',
        number: 'N-1',
        receivedAt: '2025-01-01',
        receivedWeight: 100,
        purchaseWeight: 100,
        purchasePrice: 100,
      } as CreateCattleDto;

      cattleService.create.mockRejectedValue(new Error('create error'));

      await expect(controller.create(session, dto)).rejects.toThrow('create error');
    });
  });

  describe('update', () => {
    it('delega en cattleService.update con tenant, id, dto y user sub', async () => {
      const dto = { number: 'N-2' } as UpdateCattleDto;
      const updated = { id: 'c1', number: 'N-2' } as Cattle;

      cattleService.update.mockResolvedValue(updated);

      const out = await controller.update('c1', session, dto);

      expect(cattleService.update).toHaveBeenCalledWith('tenant-1', 'c1', dto, 'user-1');
      expect(out).toBe(updated);
    });

    it('propaga errores de cattleService.update', async () => {
      const dto = { number: 'N-2' } as UpdateCattleDto;

      cattleService.update.mockRejectedValue(new Error('update error'));

      await expect(controller.update('c1', session, dto)).rejects.toThrow('update error');
    });
  });

  describe('addMedication', () => {
    it('delega en cattleService.addMedicationHistory', async () => {
      const dto = {
        medicationName: 'Ivermectin',
        dosage: '10ml',
        lot: 'L1',
      } as CreateCattleMedicationHistoryDto;

      const result = { id: 'med-1' };
      cattleService.addMedicationHistory.mockResolvedValue(result);

      const out = await controller.addMedication('c1', session, dto);

      expect(cattleService.addMedicationHistory).toHaveBeenCalledWith(
        'tenant-1',
        'c1',
        dto,
        'user-1',
      );
      expect(out).toBe(result);
    });
  });

  describe('remove', () => {
    it('delega en cattleService.remove con tenant e id', async () => {
      cattleService.remove.mockResolvedValue(undefined);

      await controller.remove('c1', session);

      expect(cattleService.remove).toHaveBeenCalledWith('tenant-1', 'c1');
    });

    it('propaga errores de cattleService.remove', async () => {
      cattleService.remove.mockRejectedValue(new NotFoundException('Cattle not found'));

      await expect(controller.remove('c1', session)).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('delega en listPaged y retorna PagedResponseDto', async () => {
      const query = { page: 2, limit: 10 } as CattleListQueryDto;
      const items = [{ id: 'c1' }] as Cattle[];

      cattleService.listPaged.mockResolvedValue({
        items,
        total: 1,
        page: 2,
        limit: 10,
      });

      const out = await controller.list(session, query);

      expect(cattleService.listPaged).toHaveBeenCalledWith('tenant-1', query);
      expect(out).toEqual(PagedResponseDto.of(2, 10, 1, items));
    });

    it('propaga errores de listPaged', async () => {
      cattleService.listPaged.mockRejectedValue(new Error('list error'));

      await expect(controller.list(session, {} as CattleListQueryDto)).rejects.toThrow('list error');
    });
  });

  describe('getBasicInfo', () => {
    it('delega en cattleService.getBasicInfo', async () => {
      const result = [{ id: 'c1', number: 'N1' }];

      cattleService.getBasicInfo.mockResolvedValue(result);

      const out = await controller.getBasicInfo(session);

      expect(cattleService.getBasicInfo).toHaveBeenCalledWith('tenant-1');
      expect(out).toBe(result);
    });
  });

  describe('getBasicInfoPaged', () => {
    it('delega en cattleService.getBasicInfoPaged', async () => {
      const query = { cursor: 'abc', limit: 50 } as CattleBasicQueryDto;
      const result = { items: [], nextCursor: null };

      cattleService.getBasicInfoPaged.mockResolvedValue(result);

      const out = await controller.getBasicInfoPaged(session, query);

      expect(cattleService.getBasicInfoPaged).toHaveBeenCalledWith('tenant-1', query);
      expect(out).toBe(result);
    });
  });

  describe('findSimpleEventsByCattle', () => {
    it('mapea links a respuesta pública sin campos internos', async () => {
      const appliedAt = new Date('2025-01-01');

      animalSimpleEventRepository.findByCattle.mockResolvedValue([
        {
          id: 'link-1',
          idSimpleEvent: 'se-1',
          appliedAt,
          appliedBy: 'user-1',
          internalField: 'not-returned',
        },
      ]);

      const out = await controller.findSimpleEventsByCattle('c1', session);

      expect(animalSimpleEventRepository.findByCattle).toHaveBeenCalledWith('tenant-1', 'c1');
      expect(out).toEqual([
        {
          idSimpleEvent: 'se-1',
          appliedAt,
          appliedBy: 'user-1',
        },
      ]);
    });
  });

  describe('applyEventsToSingleCattle', () => {
    const validBody = {
      applied: {
        cattleNumber: 'C-001',
        idMassiveEvent: 'me-1',
        events: [
          {
            type: SimpleEventType.WEIGHT,
            data: { weight: 350 },
            idSimpleEvent: 'se-1',
          },
        ],
      },
    };

    it('delega en applyMultipleSimpleEventsByNumber_transaction con cattleNumber en body', async () => {
      const result = [{ id: 'ase-1' }];
      cattleService.applyMultipleSimpleEventsByNumber_transaction.mockResolvedValue(result);

      const out = await controller.applyEventsToSingleCattle(session, validBody);

      expect(cattleService.applyMultipleSimpleEventsByNumber_transaction).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        'C-001',
        'me-1',
        validBody.applied.events,
      );
      expect(out).toBe(result);
    });

    it('aplica trim a cattleNumber antes del lookup', async () => {
      cattleService.applyMultipleSimpleEventsByNumber_transaction.mockResolvedValue([]);

      await controller.applyEventsToSingleCattle(session, {
        applied: {
          ...validBody.applied,
          cattleNumber: '  N-100  ',
        },
      });

      expect(cattleService.applyMultipleSimpleEventsByNumber_transaction).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        'N-100',
        'me-1',
        validBody.applied.events,
      );
    });

    it('acepta cattleNumber con barra (sin path param)', async () => {
      cattleService.applyMultipleSimpleEventsByNumber_transaction.mockResolvedValue([]);

      await controller.applyEventsToSingleCattle(session, {
        applied: {
          ...validBody.applied,
          cattleNumber: 'LOTE/42',
        },
      });

      expect(cattleService.applyMultipleSimpleEventsByNumber_transaction).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        'LOTE/42',
        'me-1',
        validBody.applied.events,
      );
    });

    it('applyEventsToSingleCattle propaga errores del service', async () => {
      cattleService.applyMultipleSimpleEventsByNumber_transaction.mockRejectedValue(
        new Error('apply error'),
      );

      await expect(
        controller.applyEventsToSingleCattle(session, validBody),
      ).rejects.toThrow('apply error');
    });

    it('lanza BadRequestException si cattleNumber queda vacío tras trim', async () => {
      await expect(
        controller.applyEventsToSingleCattle(session, {
          applied: {
            ...validBody.applied,
            cattleNumber: '   ',
          },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(cattleService.applyMultipleSimpleEventsByNumber_transaction).not.toHaveBeenCalled();
    });
  });

  describe('applySimpleEventsToSeveralCattle', () => {
    it('delega en applyBulkSimpleEvents', async () => {
      const body: ApplySimpleEventsDto = {
        events: [
          {
            cattleNumber: 'C-001',
            type: SimpleEventType.WEIGHT,
            data: { weight: 350 },
            idMassiveEvent: 'me-1',
            idSimpleEvent: 'se-1',
          },
        ],
      } as ApplySimpleEventsDto;

      const result = [{ id: 'c1' }];
      cattleService.applyBulkSimpleEvents.mockResolvedValue(result);

      const out = await controller.applySimpleEventsToSeveralCattle(session, body);

      expect(cattleService.applyBulkSimpleEvents).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        body.events,
      );
      expect(out).toBe(result);
    });
  });

  describe('syncSimpleEventCattle', () => {
    it('delega usando body.animalSimpleEvent y retorna { results }', async () => {
      const animalSimpleEvent = [
        {
          id: 'local-1',
          cattleNumber: 'C-001',
          type: SimpleEventType.WEIGHT,
          dataJson: '{"weight":350}',
          appliedAt: '2025-01-01T00:00:00.000Z',
          idMassiveEvent: 'me-1',
          idSimpleEvent: 'se-1',
        },
      ];

      const results = [{ id: 'local-1', status: 'synced' }];
      cattleService.syncCattleSimpleEvents.mockResolvedValue(results);

      const out = await controller.syncSimpleEventCattle(session, {
        animalSimpleEvent,
      } as never);

      expect(cattleService.syncCattleSimpleEvents).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        animalSimpleEvent,
      );
      expect(out).toEqual({ results });
    });

    it('syncSimpleEventCattle propaga errores del service', async () => {
      cattleService.syncCattleSimpleEvents.mockRejectedValue(new Error('sync error'));

      await expect(
        controller.syncSimpleEventCattle(session, { animalSimpleEvent: [] } as never),
      ).rejects.toThrow('sync error');
    });

    it('syncSimpleEventCattle lanza BadRequestException si animalSimpleEvent no es array', async () => {
      await expect(
        controller.syncSimpleEventCattle(session, {} as never),
      ).rejects.toThrow(BadRequestException);

      expect(cattleService.syncCattleSimpleEvents).not.toHaveBeenCalled();
    });
  });

  describe('import', () => {
    it('delega en cattleService.import con file y tenant', async () => {
      const file = { originalname: 'cattle.xlsx', path: '/tmp/cattle.xlsx' } as Express.Multer.File;
      const result = { importedCount: 1, skippedCount: 0, errors: [] };

      cattleService.import.mockResolvedValue(result);

      const out = await controller.import(session, file);

      expect(cattleService.import).toHaveBeenCalledWith(file, 'tenant-1');
      expect(out).toBe(result);
    });

    it('import propaga errores del service', async () => {
      const file = { originalname: 'bad.xlsx', path: '/tmp/bad.xlsx' } as Express.Multer.File;

      cattleService.import.mockRejectedValue(new Error('import error'));

      await expect(controller.import(session, file)).rejects.toThrow('import error');
    });
  });

  describe('validateCattleByNumber', () => {
    it('delega en service con number y tenant', async () => {
      const cattle = { id: 'c1', number: 'N1' } as Cattle;
      cattleService.validateCattleByNumber.mockResolvedValue(cattle);

      const out = await controller.validateCattleByNumber('N1', session);

      expect(cattleService.validateCattleByNumber).toHaveBeenCalledWith('N1', 'tenant-1');
      expect(out).toBe(cattle);
    });
  });

  describe('recordWeightHistory', () => {
    it('delega en service con id, dto, tenant y user', async () => {
      const dto = { weight: 350, date: '2025-01-01' };
      const result = { id: 'w1' };

      cattleService.recordWeightHistory.mockResolvedValue(result);

      const out = await controller.recordWeightHistory('c1', dto, session);

      expect(cattleService.recordWeightHistory).toHaveBeenCalledWith('c1', dto, 'tenant-1', 'user-1');
      expect(out).toBe(result);
    });
  });

  describe('updateCattleWeight', () => {
    it('delega en service con id, weight y tenant', async () => {
      const result = { id: 'c1', lastWeight: 420 };
      cattleService.updateCattleWeight.mockResolvedValue(result);

      const out = await controller.updateCattleWeight('c1', { weight: 420 }, session);

      expect(cattleService.updateCattleWeight).toHaveBeenCalledWith('c1', 420, 'tenant-1');
      expect(out).toBe(result);
    });
  });

  describe('bulkUpdateStatus', () => {
    it('delega en service con cattleIds, status y tenant', async () => {
      const dto = {
        cattleIds: ['c1', 'c2'],
        status: CattleStatus.SOLD,
      };

      const result = { updated: 2 };
      cattleService.bulkUpdateStatus.mockResolvedValue(result);

      const out = await controller.bulkUpdateStatus(dto, session);

      expect(cattleService.bulkUpdateStatus).toHaveBeenCalledWith(
        ['c1', 'c2'],
        CattleStatus.SOLD,
        'tenant-1',
      );
      expect(out).toBe(result);
    });
  });
});
