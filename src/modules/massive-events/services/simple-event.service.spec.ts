jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-default-uuid'),
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import { SimpleEventService } from './simple-event.service';
import { SimpleEventRepository } from '../repositories/simple-event.repository';
import { MassiveEventService } from './massive-event.service';
import { SimpleEvent } from '../entities/simple-event.entity';
import { MassiveEvent } from '../entities/massive-events.entity';
import { SimpleEventType } from '../enums/simple-event-type.enum';
import { CreateSimpleEventDto } from '../dto/create-simple-event.dto';
import { SyncSimpleEventDto } from '../dto/sync-simple-events.dto';

describe('SimpleEventService', () => {
  let service: SimpleEventService;
  let dataSource: { transaction: jest.Mock };
  let simpleEventRepo: {
    findById: jest.Mock;
    findByMassiveEvent: jest.Mock;
    deleteById: jest.Mock;
    deleteByMassiveEvent: jest.Mock;
    createInstance: jest.Mock;
    save: jest.Mock;
    saveWithManager: jest.Mock;
    updateSimpleEvent: jest.Mock;
    findByIds: jest.Mock;
  };
  let massiveEventService: { findByIdOrFail: jest.Mock };
  let mockManager: { findOne: jest.Mock };

  const tenantId = 'tenant-1';
  const massiveId = 'massive-1';
  const simpleId = 'simple-1';

  beforeEach(() => {
    (uuidV4 as jest.Mock).mockReturnValue('mock-default-uuid');
    mockManager = { findOne: jest.fn() };
    dataSource = {
      transaction: jest.fn(async (cb: (m: EntityManager) => Promise<unknown>) =>
        cb(mockManager as unknown as EntityManager),
      ),
    };
    simpleEventRepo = {
      findById: jest.fn(),
      findByMassiveEvent: jest.fn(),
      deleteById: jest.fn(),
      deleteByMassiveEvent: jest.fn(),
      createInstance: jest.fn(),
      save: jest.fn(),
      saveWithManager: jest.fn(),
      updateSimpleEvent: jest.fn(),
      findByIds: jest.fn(),
    };
    massiveEventService = { findByIdOrFail: jest.fn() };

    service = new SimpleEventService(
      dataSource as unknown as DataSource,
      simpleEventRepo as unknown as SimpleEventRepository,
      massiveEventService as unknown as MassiveEventService,
    );
  });

  describe('createSimpleEvent', () => {
    it('valida massive event y persiste nuevo simple event en transacción', async () => {
      const saved = { id: simpleId, idMassiveEvent: massiveId, type: SimpleEventType.WEIGHT } as unknown as SimpleEvent;
      massiveEventService.findByIdOrFail.mockResolvedValue({ id: massiveId } as MassiveEvent);
      mockManager.findOne.mockResolvedValue(null);
      simpleEventRepo.createInstance.mockReturnValue(saved);
      simpleEventRepo.saveWithManager.mockResolvedValue(saved);

      const dto: CreateSimpleEventDto = {
        idMassiveEvent: massiveId,
        type: SimpleEventType.WEIGHT,
      };

      const out = await service.createSimpleEvent(tenantId, dto);

      expect(massiveEventService.findByIdOrFail).toHaveBeenCalledWith(tenantId, massiveId);
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(simpleEventRepo.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          idMassiveEvent: massiveId,
          idTenant: tenantId,
          type: SimpleEventType.WEIGHT,
          isActive: true,
          data: null,
          createdAt: expect.any(Date),
        }),
      );
      expect(simpleEventRepo.saveWithManager).toHaveBeenCalledWith(
        mockManager as unknown as EntityManager,
        expect.objectContaining({ idMassiveEvent: massiveId, type: SimpleEventType.WEIGHT }),
      );
      expect(out).toBe(saved);
    });

    it('lanza BadRequestException si idMassiveEvent es solo espacios (tras validar massive event)', async () => {
      massiveEventService.findByIdOrFail.mockResolvedValue({ id: massiveId } as MassiveEvent);
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.createSimpleEvent(tenantId, { idMassiveEvent: '   ', type: SimpleEventType.WEIGHT }),
      ).rejects.toThrow(BadRequestException);
    });

    it('serializa data a JSON y persiste objeto medication', async () => {
      const saved = { id: simpleId, type: SimpleEventType.MEDICATION } as unknown as SimpleEvent;
      massiveEventService.findByIdOrFail.mockResolvedValue({ id: massiveId } as MassiveEvent);
      mockManager.findOne.mockResolvedValue(null);
      simpleEventRepo.createInstance.mockImplementation((x: object) => ({ ...x, id: simpleId }) as SimpleEvent);
      simpleEventRepo.saveWithManager.mockResolvedValue(saved);

      const dto: CreateSimpleEventDto = {
        idMassiveEvent: massiveId,
        type: SimpleEventType.MEDICATION,
        data: { medicationName: 'Ivermectin', dosage: '10ml', lot: 'L1' },
      };

      await service.createSimpleEvent(tenantId, dto);

      expect(simpleEventRepo.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          data: dto.data,
        }),
      );
    });

    it('cuando findOne devuelve existente no crea ni guarda de nuevo', async () => {
      (uuidV4 as jest.Mock).mockReturnValue('existing-id');
      const existing = { id: 'existing-id' } as unknown as SimpleEvent;
      massiveEventService.findByIdOrFail.mockResolvedValue({ id: massiveId } as MassiveEvent);
      mockManager.findOne.mockResolvedValue(existing);

      const dto: CreateSimpleEventDto = { idMassiveEvent: massiveId, type: SimpleEventType.WEIGHT };
      const out = await service.createSimpleEvent(tenantId, dto);

      expect(out).toBe(existing);
      expect(simpleEventRepo.createInstance).not.toHaveBeenCalled();
      expect(simpleEventRepo.saveWithManager).not.toHaveBeenCalled();
    });
  });

  describe('syncSimpleEvents', () => {
    it('con lista vacía ejecuta transacción y retorna array vacío', async () => {
      const out = await service.syncSimpleEvents(tenantId, []);
      expect(out).toEqual([]);
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('marca failed cuando massive event no existe', async () => {
      massiveEventService.findByIdOrFail.mockRejectedValue(new NotFoundException());
      const dtos: SyncSimpleEventDto[] = [
        {
          id: simpleId,
          idTenant: tenantId,
          massiveEventServerId: massiveId,
          type: SimpleEventType.WEIGHT,
        },
      ];

      const out = await service.syncSimpleEvents(tenantId, dtos);

      expect(out).toEqual([
        {
          id: simpleId,
          status: 'failed',
          serverId: '',
          message: 'MassiveEvent not found',
        },
      ]);
      expect(simpleEventRepo.saveWithManager).not.toHaveBeenCalled();
    });

    it('synced cuando payload es válido', async () => {
      const saved = { id: simpleId } as unknown as SimpleEvent;
      massiveEventService.findByIdOrFail.mockResolvedValue({ id: massiveId } as MassiveEvent);
      mockManager.findOne.mockResolvedValue(null);
      simpleEventRepo.createInstance.mockReturnValue(saved);
      simpleEventRepo.saveWithManager.mockResolvedValue(saved);

      const dtos: SyncSimpleEventDto[] = [
        {
          id: simpleId,
          idTenant: tenantId,
          massiveEventServerId: massiveId,
          type: SimpleEventType.WEIGHT,
        },
      ];

      const out = await service.syncSimpleEvents(tenantId, dtos);

      expect(out).toEqual([{ id: simpleId, status: 'synced', serverId: simpleId }]);
      expect(simpleEventRepo.saveWithManager).toHaveBeenCalled();
    });

    it('no llama saveWithManager si el simple event ya existe en BD', async () => {
      const existing = { id: simpleId } as unknown as SimpleEvent;
      massiveEventService.findByIdOrFail.mockResolvedValue({ id: massiveId } as MassiveEvent);
      mockManager.findOne.mockResolvedValue(existing);

      const dtos: SyncSimpleEventDto[] = [
        {
          id: simpleId,
          idTenant: tenantId,
          massiveEventServerId: massiveId,
          type: SimpleEventType.WEIGHT,
        },
      ];

      const out = await service.syncSimpleEvents(tenantId, dtos);

      expect(simpleEventRepo.saveWithManager).not.toHaveBeenCalled();
      expect(out).toEqual([{ id: simpleId, status: 'synced', serverId: simpleId }]);
    });

    it('mezcla failed y synced en el mismo batch', async () => {
      const idFail = 'se-fail';
      const idOk = 'se-ok';
      massiveEventService.findByIdOrFail
        .mockRejectedValueOnce(new NotFoundException())
        .mockResolvedValueOnce({ id: massiveId } as MassiveEvent);
      mockManager.findOne.mockResolvedValue(null);
      simpleEventRepo.createInstance.mockReturnValue({ id: idOk } as SimpleEvent);
      simpleEventRepo.saveWithManager.mockResolvedValue({ id: idOk } as SimpleEvent);

      const dtos: SyncSimpleEventDto[] = [
        { id: idFail, idTenant: tenantId, massiveEventServerId: 'missing', type: SimpleEventType.WEIGHT },
        { id: idOk, idTenant: tenantId, massiveEventServerId: massiveId, type: SimpleEventType.WEIGHT },
      ];

      const out = await service.syncSimpleEvents(tenantId, dtos);

      expect(out[0]).toMatchObject({ id: idFail, status: 'failed' });
      expect(out[1]).toMatchObject({ id: idOk, status: 'synced' });
    });

    it('propaga createdAt e isActive en saveNewSimpleEvent', async () => {
      massiveEventService.findByIdOrFail.mockResolvedValue({ id: massiveId } as MassiveEvent);
      mockManager.findOne.mockResolvedValue(null);
      simpleEventRepo.createInstance.mockReturnValue({ id: simpleId } as SimpleEvent);
      simpleEventRepo.saveWithManager.mockResolvedValue({ id: simpleId } as SimpleEvent);

      await service.syncSimpleEvents(tenantId, [
        {
          id: simpleId,
          idTenant: tenantId,
          massiveEventServerId: massiveId,
          type: SimpleEventType.WEIGHT,
          createdAt: '2025-01-01T00:00:00.000Z',
          isActive: false,
        },
      ]);

      const createdAtArg = (simpleEventRepo.createInstance.mock.calls[0][0] as { createdAt: Date }).createdAt;
      expect(createdAtArg.toISOString()).toBe('2025-01-01T00:00:00.000Z');
      expect(simpleEventRepo.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        }),
      );
    });
  });

  describe('findByIdOrFail', () => {
    it('retorna el evento cuando existe', async () => {
      const row = { id: simpleId } as unknown as SimpleEvent;
      simpleEventRepo.findById.mockResolvedValue(row);

      const out = await service.findByIdOrFail(tenantId, simpleId);

      expect(out).toBe(row);
      expect(simpleEventRepo.findById).toHaveBeenCalledWith(tenantId, simpleId, undefined);
    });

    it('pasa manager al repositorio cuando se provee', async () => {
      const manager = {} as EntityManager;
      const row = { id: simpleId } as unknown as SimpleEvent;
      simpleEventRepo.findById.mockResolvedValue(row);

      await service.findByIdOrFail(tenantId, simpleId, manager);

      expect(simpleEventRepo.findById).toHaveBeenCalledWith(tenantId, simpleId, manager);
    });

    it('lanza NotFoundException cuando no existe', async () => {
      simpleEventRepo.findById.mockResolvedValue(null);
      await expect(service.findByIdOrFail(tenantId, simpleId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByMassiveEvent', () => {
    it('delega en simpleEventRepo.findByMassiveEvent', async () => {
      const rows = [] as SimpleEvent[];
      simpleEventRepo.findByMassiveEvent.mockResolvedValue(rows);
      const out = await service.findByMassiveEvent(tenantId, massiveId);
      expect(out).toBe(rows);
      expect(simpleEventRepo.findByMassiveEvent).toHaveBeenCalledWith(tenantId, massiveId);
    });
  });

  describe('delete', () => {
    it('delega en deleteById', async () => {
      simpleEventRepo.deleteById.mockResolvedValue(undefined);
      await service.delete(simpleId);
      expect(simpleEventRepo.deleteById).toHaveBeenCalledWith(simpleId);
    });
  });

  describe('deleteByMassiveEvent', () => {
    it('delega en repositorio con manager y idMassiveEvent', async () => {
      const manager = {} as EntityManager;
      simpleEventRepo.deleteByMassiveEvent.mockResolvedValue(undefined);
      await service.deleteByMassiveEvent(manager, massiveId);
      expect(simpleEventRepo.deleteByMassiveEvent).toHaveBeenCalledWith(manager, massiveId);
    });
  });

  describe('findByIds', () => {
    it('delega en simpleEventRepo.findByIds', async () => {
      const manager = {} as EntityManager;
      const rows = [] as SimpleEvent[];
      simpleEventRepo.findByIds.mockResolvedValue(rows);
      const out = await service.findByIds(tenantId, [simpleId], manager);
      expect(out).toBe(rows);
      expect(simpleEventRepo.findByIds).toHaveBeenCalledWith(tenantId, [simpleId], manager);
    });
  });

  describe('validateDataFields', () => {
    it('medication sin data lanza BadRequestException', () => {
      expect(() => service.validateDataFields('medication', undefined)).toThrow(BadRequestException);
    });

    it('medication con string vacío lanza BadRequestException', () => {
      expect(() => service.validateDataFields('medication', '   ')).toThrow(BadRequestException);
    });

    it('medication con JSON inválido lanza', () => {
      expect(() => service.validateDataFields('medication', '{bad')).toThrow();
    });

    it('medication válido como objeto no lanza', () => {
      expect(() =>
        service.validateDataFields('medication', {
          medicationName: 'Ivermectin',
          dosage: '10 ml',
          lot: 'L-001',
        }),
      ).not.toThrow();
    });

    it('medication JSON string válido no lanza', () => {
      expect(() =>
        service.validateDataFields(
          'medication',
          JSON.stringify({ medicationName: 'M', dosage: '1', lot: 'L' }),
        ),
      ).not.toThrow();
    });

    it.each([
      ['sin medicationName', { dosage: '1', lot: 'L' }],
      ['sin dosage', { medicationName: 'M', lot: 'L' }],
      ['sin lot', { medicationName: 'M', dosage: '1' }],
      ['medicationName vacío', { medicationName: '', dosage: '1', lot: 'L' }],
      ['dosage vacío', { medicationName: 'M', dosage: ' ', lot: 'L' }],
      ['lot vacío', { medicationName: 'M', dosage: '1', lot: '' }],
    ])('medication %s lanza BadRequestException', (_label, data) => {
      expect(() => service.validateDataFields('medication', data)).toThrow(BadRequestException);
    });

    it('weight no aplica validación medication y no lanza', () => {
      expect(() => service.validateDataFields(SimpleEventType.WEIGHT, undefined)).not.toThrow();
    });
  });

  describe('updateSimpleEvent', () => {
    it('actualiza cuando existe y data válida', async () => {
      const row = { id: simpleId, type: SimpleEventType.WEIGHT } as unknown as SimpleEvent;
      simpleEventRepo.findById.mockResolvedValue(row);
      simpleEventRepo.updateSimpleEvent.mockResolvedValue(row);

      const out = await service.updateSimpleEvent(tenantId, simpleId, { isActive: true, data: undefined });

      expect(simpleEventRepo.updateSimpleEvent).toHaveBeenCalledWith(
        simpleId,
        { isActive: true, data: undefined },
        mockManager as unknown as EntityManager,
      );
      expect(out).toBe(row);
    });

    it('data inválida para MEDICATION no llama updateSimpleEvent', async () => {
      const row = { id: simpleId, type: SimpleEventType.MEDICATION } as unknown as SimpleEvent;
      simpleEventRepo.findById.mockResolvedValue(row);

      await expect(
        service.updateSimpleEvent(tenantId, simpleId, { isActive: true, data: { foo: 1 } as any }),
      ).rejects.toThrow(BadRequestException);
      expect(simpleEventRepo.updateSimpleEvent).not.toHaveBeenCalled();
    });

    it('no llama update cuando findByIdOrFail falla', async () => {
      simpleEventRepo.findById.mockResolvedValue(null);
      await expect(
        service.updateSimpleEvent(tenantId, simpleId, { isActive: false, data: undefined }),
      ).rejects.toThrow(NotFoundException);
      expect(simpleEventRepo.updateSimpleEvent).not.toHaveBeenCalled();
    });
  });
});
