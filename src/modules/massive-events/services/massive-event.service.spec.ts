import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { MassiveEventService } from './massive-event.service';
import { MassiveEventRepository } from '../repositories/massive-event.repository';
import { SimpleEventRepository } from '../repositories/simple-event.repository';
import { AnimalSimpleEventRepository } from '../repositories/animal-simple-event.repository';
import { CattleRepository } from 'src/modules/farm/repositories/cattle.repository';
import { MassiveEvent } from '../entities/massive-events.entity';
import { SimpleEvent } from '../entities/simple-event.entity';
import { CreateMassiveEventDto } from '../dto/create-massive-event.dto';
import { SyncMassiveEventDto } from '../dto/sync-massive-event.dto';
import { SimpleEventType } from '../enums/simple-event-type.enum';

describe('MassiveEventService', () => {
  let service: MassiveEventService;
  let dataSource: { transaction: jest.Mock };
  let massiveEventRepo: {
    findById: jest.Mock;
    findOneWithSimpleEvents: jest.Mock;
    findAllByTenant: jest.Mock;
    createInstance: jest.Mock;
    saveWithManager: jest.Mock;
  };
  let simpleEventRepo: { createInstance: jest.Mock; saveWithManager: jest.Mock };
  let animalSimpleEventRepo: Record<string, never>;
  let cattleRepo: Record<string, never>;
  let mockManager: Record<string, jest.Mock>;

  const tenantId = 'tenant-1';
  const eventId = 'massive-1';

  beforeEach(() => {
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(async (cb: (m: EntityManager) => Promise<unknown>) => cb(mockManager as unknown as EntityManager)),
    };
    massiveEventRepo = {
      findById: jest.fn(),
      findOneWithSimpleEvents: jest.fn(),
      findAllByTenant: jest.fn(),
      createInstance: jest.fn(),
      saveWithManager: jest.fn(),
    };
    simpleEventRepo = {
      createInstance: jest.fn(),
      saveWithManager: jest.fn(),
    };
    animalSimpleEventRepo = {};
    cattleRepo = {};

    service = new MassiveEventService(
      dataSource as unknown as DataSource,
      massiveEventRepo as unknown as MassiveEventRepository,
      simpleEventRepo as unknown as SimpleEventRepository,
      animalSimpleEventRepo as unknown as AnimalSimpleEventRepository,
      cattleRepo as unknown as CattleRepository,
    );
  });

  describe('findByIdOrFail', () => {
    it('devuelve el evento cuando existe', async () => {
      const ev = { id: eventId, idTenant: tenantId } as unknown as MassiveEvent;
      massiveEventRepo.findById.mockResolvedValue(ev);

      const out = await service.findByIdOrFail(tenantId, eventId);

      expect(out).toBe(ev);
      expect(massiveEventRepo.findById).toHaveBeenCalledWith(tenantId, eventId, undefined);
    });

    it('lanza NotFoundException cuando no existe', async () => {
      massiveEventRepo.findById.mockResolvedValue(null);
      await expect(service.findByIdOrFail(tenantId, eventId)).rejects.toThrow(NotFoundException);
    });

    it('reenvía EntityManager al findById del repositorio', async () => {
      const manager = {} as EntityManager;
      const ev = { id: eventId, idTenant: tenantId } as unknown as MassiveEvent;
      massiveEventRepo.findById.mockResolvedValue(ev);

      const out = await service.findByIdOrFail(tenantId, eventId, manager);

      expect(out).toBe(ev);
      expect(massiveEventRepo.findById).toHaveBeenCalledWith(tenantId, eventId, manager);
    });
  });

  describe('findWithSimpleEventsByIdOrFail', () => {
    it('devuelve el evento con simple events cuando existe', async () => {
      const ev = { id: eventId, idTenant: tenantId, simpleEvents: [] } as unknown as MassiveEvent;
      massiveEventRepo.findOneWithSimpleEvents.mockResolvedValue(ev);

      const out = await service.findWithSimpleEventsByIdOrFail(tenantId, eventId);

      expect(out).toBe(ev);
      expect(massiveEventRepo.findOneWithSimpleEvents).toHaveBeenCalledWith(tenantId, eventId, undefined);
    });

    it('reenvía EntityManager a findOneWithSimpleEvents', async () => {
      const manager = {} as EntityManager;
      const ev = { id: eventId, idTenant: tenantId, simpleEvents: [] } as unknown as MassiveEvent;
      massiveEventRepo.findOneWithSimpleEvents.mockResolvedValue(ev);

      const out = await service.findWithSimpleEventsByIdOrFail(tenantId, eventId, manager);

      expect(out).toBe(ev);
      expect(massiveEventRepo.findOneWithSimpleEvents).toHaveBeenCalledWith(tenantId, eventId, manager);
    });

    it('lanza NotFoundException cuando no existe', async () => {
      massiveEventRepo.findOneWithSimpleEvents.mockResolvedValue(null);

      await expect(service.findWithSimpleEventsByIdOrFail(tenantId, eventId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('delega en el repositorio por tenant', async () => {
      const list = [{ id: eventId }] as unknown as MassiveEvent[];
      massiveEventRepo.findAllByTenant.mockResolvedValue(list);

      const out = await service.findAll(tenantId);

      expect(out).toBe(list);
      expect(massiveEventRepo.findAllByTenant).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('syncMassiveEvents', () => {
    it('con lista vacía ejecuta transacción y devuelve array vacío', async () => {
      const out = await service.syncMassiveEvents(tenantId, []);
      expect(out).toEqual([]);
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('sincroniza un evento nuevo, fuerza idTenant del parámetro y valida createInstance', async () => {
      const dto: SyncMassiveEventDto = {
        id: 'sync-me-1',
        idTenant: 'otro-tenant',
        eventDate: '2025-03-01',
        status: 'open',
      };
      mockManager.findOne.mockResolvedValue(null);
      massiveEventRepo.createInstance.mockImplementation((data: Record<string, unknown>) => ({
        ...data,
        simpleEvents: [],
      }));
      massiveEventRepo.saveWithManager.mockImplementation(async (_m, entity: MassiveEvent) => entity);

      const out = await service.syncMassiveEvents(tenantId, [dto]);

      expect(out).toEqual([{ id: 'sync-me-1', status: 'synced' }]);
      expect(massiveEventRepo.saveWithManager).toHaveBeenCalled();
      expect(massiveEventRepo.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sync-me-1',
          idTenant: tenantId,
          eventDate: expect.any(Date),
          status: 'open',
        }),
      );
    });

    it('si massive event ya existe no crea ni guarda de nuevo el massive', async () => {
      const existing = { id: 'me-ex', idTenant: tenantId, simpleEvents: [] } as unknown as MassiveEvent;
      mockManager.findOne.mockResolvedValueOnce(existing);
      const dto: SyncMassiveEventDto = {
        id: 'me-ex',
        idTenant: tenantId,
        eventDate: '2025-01-01',
        status: 'open',
      };

      const out = await service.syncMassiveEvents(tenantId, [dto]);

      expect(out).toEqual([{ id: 'me-ex', status: 'synced' }]);
      expect(massiveEventRepo.createInstance).not.toHaveBeenCalled();
      expect(massiveEventRepo.saveWithManager).not.toHaveBeenCalled();
    });

    it('reutiliza simple event existente y actualiza isActive con manager.save', async () => {
      const massive = { id: 'm1', idTenant: tenantId, simpleEvents: [] } as unknown as MassiveEvent;
      const existingSe = { id: 's1', isActive: true, type: SimpleEventType.WEIGHT } as unknown as SimpleEvent;
      mockManager.findOne
        .mockResolvedValueOnce(massive)
        .mockResolvedValueOnce(existingSe);
      mockManager.save.mockResolvedValue({ ...existingSe, isActive: false });
      const dto: SyncMassiveEventDto = {
        id: 'm1',
        idTenant: tenantId,
        eventDate: '2025-01-01',
        status: 'open',
        simpleEvents: [{ id: 's1', type: SimpleEventType.WEIGHT, isActive: false }],
      };

      await service.syncMassiveEvents(tenantId, [dto]);

      expect(simpleEventRepo.createInstance).not.toHaveBeenCalled();
      expect(simpleEventRepo.saveWithManager).not.toHaveBeenCalled();
      expect(mockManager.save).toHaveBeenCalledWith(
        SimpleEvent,
        expect.objectContaining({ id: 's1', isActive: false }),
      );
    });

    it('propaga error si saveWithManager del massive falla al crear', async () => {
      mockManager.findOne.mockResolvedValue(null);
      massiveEventRepo.createInstance.mockReturnValue({
        id: 'm-err',
        idTenant: tenantId,
        simpleEvents: [],
      } as unknown as MassiveEvent);
      massiveEventRepo.saveWithManager.mockRejectedValue(new Error('persist massive failed'));
      const dto: SyncMassiveEventDto = {
        id: 'm-err',
        idTenant: tenantId,
        eventDate: '2025-01-01',
        status: 'open',
      };

      await expect(service.syncMassiveEvents(tenantId, [dto])).rejects.toThrow('persist massive failed');
    });

    it('lanza si dataJson de simple event es inválido', async () => {
      mockManager.findOne.mockResolvedValueOnce(null);
      massiveEventRepo.createInstance.mockImplementation((data: Record<string, unknown>) => ({
        ...data,
        simpleEvents: [],
      }));
      massiveEventRepo.saveWithManager.mockImplementation(async (_m, e: MassiveEvent) => e);
      const dto: SyncMassiveEventDto = {
        id: 'm-bad',
        idTenant: tenantId,
        eventDate: '2025-01-01',
        status: 'open',
        simpleEvents: [{ id: 's-bad', type: SimpleEventType.WEIGHT, dataJson: '{bad' }],
      };

      await expect(service.syncMassiveEvents(tenantId, [dto])).rejects.toThrow();
    });
  });

  describe('createMassiveEvent', () => {
    it('crea massive event y persiste vía transacción sin simple events', async () => {
      const saved = {
        id: 'new-id',
        idTenant: tenantId,
        status: 'open',
        simpleEvents: [],
      } as unknown as MassiveEvent;

      mockManager.findOne.mockResolvedValue(null);
      massiveEventRepo.createInstance.mockImplementation((data: Record<string, unknown>) => ({
        ...data,
        simpleEvents: [],
      }));
      massiveEventRepo.saveWithManager.mockImplementation(async (_m, entity: MassiveEvent) => entity);

      const dto: CreateMassiveEventDto = { eventDate: '2025-01-15' };

      const out = await service.createMassiveEvent(tenantId, 'user-1', dto);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(massiveEventRepo.createInstance).toHaveBeenCalled();
      expect(massiveEventRepo.saveWithManager).toHaveBeenCalled();
      expect(out.id).toBeDefined();
      expect(out.idTenant).toBe(tenantId);
      expect(out.status).toBe('open');
      expect(massiveEventRepo.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          idTenant: tenantId,
          status: 'open',
          createdBy: 'user-1',
          eventDate: expect.any(Date),
        }),
      );
    });

    it('crea massive event con simple events cuando no existen en BD', async () => {
      const massiveRow = { id: 'me-1', idTenant: tenantId, simpleEvents: [] } as unknown as MassiveEvent;
      const simpleRow = { id: 'se-1', type: SimpleEventType.WEIGHT } as unknown as SimpleEvent;

      mockManager.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      massiveEventRepo.createInstance.mockReturnValueOnce(massiveRow);
      massiveEventRepo.saveWithManager.mockResolvedValueOnce(massiveRow);
      simpleEventRepo.createInstance.mockReturnValue(simpleRow);
      simpleEventRepo.saveWithManager.mockResolvedValue(simpleRow);

      const dto: CreateMassiveEventDto = {
        eventDate: '2025-06-01',
        simpleEvents: [{ type: SimpleEventType.WEIGHT, data: { kg: 400 } }],
      };

      const out = await service.createMassiveEvent(tenantId, 'user-1', dto);

      expect(simpleEventRepo.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          idMassiveEvent: massiveRow.id,
          idTenant: tenantId,
          type: SimpleEventType.WEIGHT,
          data: { kg: 400 },
        }),
      );
      expect(simpleEventRepo.saveWithManager).toHaveBeenCalled();
      expect(out.simpleEvents.length).toBeGreaterThanOrEqual(1);
    });
  });
});
