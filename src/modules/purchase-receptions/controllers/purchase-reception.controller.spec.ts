import { Test, TestingModule } from '@nestjs/testing';
import { ReceptionController } from './purchase-reception.controller';
import { ReceptionsService } from '../services/receptions.service';
import { CattleService } from 'src/modules/farm/services/cattle.service';
import { SimpleEventService } from 'src/modules/massive-events/services/simple-event.service';
import { PurchaseService } from 'src/modules/commerce/services/purchase.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { UpdateReceivedCattleDto } from '../dto/receive-cattle-request.dto';
import { Cattle } from 'src/modules/farm/entities/cattle.entity';

describe('ReceptionController', () => {
  let controller: ReceptionController;
  let receptionsService: { updateReceivedCattle: jest.Mock };

  const session: SessionUserDto = {
    username: 'op',
    sub: 'user-1',
    tenant_id: 'tenant-1',
    date: '2025-01-01',
    permissionsHash: 'h',
    permissions: {},
    sessionId: 'sess-1',
  };

  beforeEach(async () => {
    receptionsService = { updateReceivedCattle: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReceptionController],
      providers: [
        { provide: ReceptionsService, useValue: receptionsService },
        { provide: CattleService, useValue: {} },
        { provide: SimpleEventService, useValue: {} },
        { provide: PurchaseService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ApplicationPermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReceptionController>(ReceptionController);
  });

  describe('updateReceivedCattle', () => {
    it('delega en receptionsService con tenant, id y usuario de sesión', async () => {
      const cattle = { id: 'c1', number: '100' } as Cattle;
      receptionsService.updateReceivedCattle.mockResolvedValue(cattle);
      const dto: UpdateReceivedCattleDto = { receivedWeight: 400, color: 'BLACK' };

      const out = await controller.updateReceivedCattle(session, 'c1', dto);

      expect(out).toBe(cattle);
      expect(receptionsService.updateReceivedCattle).toHaveBeenCalledWith(
        'tenant-1',
        'c1',
        dto,
        'user-1',
      );
    });

    it('propaga errores del servicio', async () => {
      receptionsService.updateReceivedCattle.mockRejectedValue(new Error('db down'));
      await expect(
        controller.updateReceivedCattle(session, 'c1', { receivedWeight: 1 }),
      ).rejects.toThrow('db down');
    });
  });
});
