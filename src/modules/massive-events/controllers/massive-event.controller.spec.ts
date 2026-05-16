import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MassiveEventController } from './massive-event.controller';
import { MassiveEventService } from '../services/massive-event.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { MassiveEvent } from '../entities/massive-events.entity';
import { CreateMassiveEventDto } from '../dto/create-massive-event.dto';
import { MassiveEventResponseDto } from '../dto/massive-event-response.dto';
import { PagedResponseDto } from 'src/shared/dto/paged-response.dto';
import { MassiveEventListQueryDto } from '../dto/massive-event-list.query.dto';

describe('MassiveEventController', () => {
  let controller: MassiveEventController;
  let massiveEventService: {
    createMassiveEvent: jest.Mock;
    findByIdForMassiveEventsModuleOrFail: jest.Mock;
    findWithSimpleEventsForMassiveEventsModuleOrFail: jest.Mock;
    findStandaloneListPaged: jest.Mock;
    findCattleByMassiveEvent: jest.Mock;
    closeMassiveEvent: jest.Mock;
    syncMassiveEvents: jest.Mock;
    updateMassiveEventMetadata: jest.Mock;
    getUsernameForUser: jest.Mock;
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
    massiveEventService = {
      createMassiveEvent: jest.fn(),
      findByIdForMassiveEventsModuleOrFail: jest.fn(),
      findWithSimpleEventsForMassiveEventsModuleOrFail: jest.fn(),
      findStandaloneListPaged: jest.fn(),
      findCattleByMassiveEvent: jest.fn(),
      closeMassiveEvent: jest.fn(),
      syncMassiveEvents: jest.fn(),
      updateMassiveEventMetadata: jest.fn(),
      getUsernameForUser: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MassiveEventController],
      providers: [{ provide: MassiveEventService, useValue: massiveEventService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ApplicationPermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MassiveEventController>(MassiveEventController);
  });

  describe('create', () => {
    it('crea evento y devuelve DTO de respuesta', async () => {
      const entity = {
        id: 'me-1',
        idTenant: 'tenant-1',
        name: 'Lote A',
        status: 'open',
        eventDate: new Date('2025-06-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
        simpleEvents: [],
        linkedToPurchaseReception: false,
      } as MassiveEvent;
      massiveEventService.createMassiveEvent.mockResolvedValue(entity);
      const dto: CreateMassiveEventDto = { eventDate: '2025-06-01', name: 'Lote A' };

      const out = await controller.create(session, dto);

      expect(massiveEventService.createMassiveEvent).toHaveBeenCalledWith('tenant-1', 'user-1', dto);
      expect(out).toEqual(MassiveEventResponseDto.toResponseDto(entity, entity.simpleEvents ?? []));
    });

    it('create trata simpleEvents undefined como array vacío', async () => {
      const entity = {
        id: 'me-1',
        idTenant: 'tenant-1',
        name: 'Lote A',
        status: 'open',
        eventDate: new Date('2025-06-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
        linkedToPurchaseReception: false,
      } as MassiveEvent;

      massiveEventService.createMassiveEvent.mockResolvedValue(entity);

      const dto: CreateMassiveEventDto = { eventDate: '2025-06-01', name: 'Lote A' };

      const out = await controller.create(session, dto);

      expect(out).toEqual(MassiveEventResponseDto.toResponseDto(entity, []));
    });

    it('propaga errores de createMassiveEvent', async () => {
      const dto: CreateMassiveEventDto = { eventDate: '2025-06-01', name: 'Lote A' };

      massiveEventService.createMassiveEvent.mockRejectedValue(new Error('db error'));

      await expect(controller.create(session, dto)).rejects.toThrow('db error');
    });
  });

  describe('findOne', () => {
    it('obtiene por id y mapea a response DTO', async () => {
      const entity = {
        id: 'me-1',
        idTenant: 'tenant-1',
        name: 'Test',
        status: 'open',
        eventDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        simpleEvents: [],
        linkedToPurchaseReception: false,
        createdBy: 'user-1',
      } as MassiveEvent;
      massiveEventService.findWithSimpleEventsForMassiveEventsModuleOrFail.mockResolvedValue(entity);
      massiveEventService.getUsernameForUser.mockResolvedValue('alice');

      const out = await controller.findOne(session, 'me-1');

      expect(massiveEventService.findWithSimpleEventsForMassiveEventsModuleOrFail).toHaveBeenCalledWith(
        'tenant-1',
        'me-1',
      );
      expect(massiveEventService.getUsernameForUser).toHaveBeenCalledWith('tenant-1', 'user-1');
      expect(out).toEqual(
        MassiveEventResponseDto.toResponseDto(entity, entity.simpleEvents ?? [], { createdByUsername: 'alice' }),
      );
    });

    it('propaga errores de findWithSimpleEventsForMassiveEventsModuleOrFail', async () => {
      massiveEventService.findWithSimpleEventsForMassiveEventsModuleOrFail.mockRejectedValue(
        new NotFoundException('not found'),
      );

      await expect(controller.findOne(session, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAppliedCattleIdsByMassiveEvent', () => {
    it('delega en service con tenant e idMassiveEvent', async () => {
      const result = [
        { idCattle: 'c1', number: 'N1' },
        { idCattle: 'c2', number: 'N2' },
      ];

      massiveEventService.findByIdForMassiveEventsModuleOrFail.mockResolvedValue({ id: 'me-1' } as MassiveEvent);
      massiveEventService.findCattleByMassiveEvent.mockResolvedValue(result);

      const out = await controller.getAppliedCattleIdsByMassiveEvent('me-1', session);

      expect(massiveEventService.findByIdForMassiveEventsModuleOrFail).toHaveBeenCalledWith('tenant-1', 'me-1');
      expect(massiveEventService.findCattleByMassiveEvent).toHaveBeenCalledWith(
        'tenant-1',
        'me-1',
      );
      expect(out).toBe(result);
    });

    it('getAppliedCattleIdsByMassiveEvent propaga errores del service', async () => {
      massiveEventService.findByIdForMassiveEventsModuleOrFail.mockResolvedValue({} as MassiveEvent);
      massiveEventService.findCattleByMassiveEvent.mockRejectedValue(new Error('lookup error'));

      await expect(
        controller.getAppliedCattleIdsByMassiveEvent('me-1', session),
      ).rejects.toThrow('lookup error');
    });
  });

  describe('list', () => {
    const query = new MassiveEventListQueryDto();

    it('lista eventos paginados y mapea cada uno a response DTO', async () => {
      const e1 = {
        id: 'a',
        idTenant: 'tenant-1',
        name: 'A',
        status: 'open',
        eventDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        simpleEvents: [],
        linkedToPurchaseReception: false,
      } as MassiveEvent;
      const e2 = { ...e1, id: 'b' } as MassiveEvent;
      massiveEventService.findStandaloneListPaged.mockResolvedValue({
        items: [e1, e2],
        total: 2,
        page: 1,
        limit: 10,
        usernameByUserId: new Map<string, string>(),
      });

      const out = await controller.list(session, query);

      expect(massiveEventService.findStandaloneListPaged).toHaveBeenCalledWith('tenant-1', query);
      expect(out).toEqual(
        PagedResponseDto.of(1, 10, 2, [
          MassiveEventResponseDto.toResponseDto(e1, e1.simpleEvents ?? []),
          MassiveEventResponseDto.toResponseDto(e2, e2.simpleEvents ?? []),
        ]),
      );
    });

    it('trata massive events sin simpleEvents como array vacío en el DTO', async () => {
      const entity = {
        id: 'me-1',
        idTenant: 'tenant-1',
        name: 'Solo',
        status: 'open',
        eventDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        linkedToPurchaseReception: false,
      } as MassiveEvent;

      massiveEventService.findStandaloneListPaged.mockResolvedValue({
        items: [entity],
        total: 1,
        page: 1,
        limit: 10,
        usernameByUserId: new Map<string, string>(),
      });

      const out = await controller.list(session, query);

      expect(out).toEqual(PagedResponseDto.of(1, 10, 1, [MassiveEventResponseDto.toResponseDto(entity, [])]));
    });

    it('list propaga errores de findStandaloneListPaged', async () => {
      massiveEventService.findStandaloneListPaged.mockRejectedValue(new Error('db error'));

      await expect(controller.list(session, query)).rejects.toThrow('db error');
    });
  });

  describe('close', () => {
    it('delega en closeMassiveEvent y retorna undefined', async () => {
      massiveEventService.closeMassiveEvent.mockResolvedValue(undefined);

      const out = await controller.close(session, 'me-1');

      expect(massiveEventService.closeMassiveEvent).toHaveBeenCalledWith('tenant-1', 'me-1');
      expect(out).toBeUndefined();
    });

    it('propaga errores del service al cerrar', async () => {
      massiveEventService.closeMassiveEvent.mockRejectedValue(new Error('cannot close'));

      await expect(controller.close(session, 'me-1')).rejects.toThrow('cannot close');
    });
  });

  describe('sync', () => {
    it('delega en syncMassiveEvents con tenant y body.massiveEvents', async () => {
      const body = {
        massiveEvents: [
          {
            id: 'me-local-1',
            name: 'Lote sync',
            eventDate: '2025-01-01',
            status: 'open',
            simpleEvents: [],
          },
        ],
      };

      const result = [{ id: 'me-local-1', status: 'synced' }];
      massiveEventService.syncMassiveEvents.mockResolvedValue(result);

      const out = await controller.sync(session, body as never);

      expect(massiveEventService.syncMassiveEvents).toHaveBeenCalledWith(
        'tenant-1',
        body.massiveEvents,
      );
      expect(out).toBe(result);
    });

    it('propaga errores de syncMassiveEvents', async () => {
      massiveEventService.syncMassiveEvents.mockRejectedValue(new Error('sync error'));

      await expect(
        controller.sync(session, { massiveEvents: [] } as never),
      ).rejects.toThrow('sync error');
    });
  });
});
