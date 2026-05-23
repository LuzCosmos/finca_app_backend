import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CattleRemoteConfigController } from './cattle-remote-config.controller';
import { CattleDeviceHistoryRepository } from '../repositories/cattle-device-history.repository';
import { DeviceRepository } from '../../production-center/repositories/device.repository';
import { DeviceRemoteConfigurationService } from '../../production-center/services/device-remote-configuration.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from '../../../common/application-permissions/application-permissions.guard';
import { SessionUserDto } from '../../auth/dto/session-user.dto';

/**
 * Spec dedicado a los endpoints `cattle/:idCattle/remote-config/diagnostic-mode/{enable,disable}`.
 *
 * Cubre el flujo de resolución por res:
 *  - `idCattle` → asignación activa en `cattle_device_history` → `device.deveui`.
 *  - 404 cuando no hay asignación activa (cattle sin device).
 *  - Que tras resolver, el controller delega exactamente igual que el endpoint
 *    indexado por DevEUI (mismo flujo, sin duplicación lógica).
 */
describe('CattleRemoteConfigController · diagnostic-mode', () => {
  const session: SessionUserDto = {
    username: 'admin',
    sub: 'user-1',
    tenant_id: 'tenant-1',
    date: '2025-01-01',
    permissionsHash: 'h',
    permissions: {},
    sessionId: 'sess-1',
  };

  let controller: CattleRemoteConfigController;
  let cattleDeviceHistoryRepo: { findActiveByCattle: jest.Mock };
  let deviceRepo: { findByIdAndTenantId: jest.Mock };
  let remoteConfig: { enableDiagnosticMode: jest.Mock; disableDiagnosticMode: jest.Mock };

  beforeEach(async () => {
    cattleDeviceHistoryRepo = {
      findActiveByCattle: jest.fn().mockResolvedValue({ idDevice: 'dev-1' }),
    };
    deviceRepo = {
      findByIdAndTenantId: jest.fn().mockResolvedValue({ id: 'dev-1', deveui: '11AA22BB' }),
    };
    remoteConfig = {
      enableDiagnosticMode: jest
        .fn()
        .mockResolvedValue({ command: { id: 'c-enable' }, diagnosticState: { ttlMinutes: 30 } }),
      disableDiagnosticMode: jest
        .fn()
        .mockResolvedValue({ command: { id: 'c-disable' }, restoredFrom: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CattleRemoteConfigController],
      providers: [
        { provide: CattleDeviceHistoryRepository, useValue: cattleDeviceHistoryRepo },
        { provide: DeviceRepository, useValue: deviceRepo },
        { provide: DeviceRemoteConfigurationService, useValue: remoteConfig },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ApplicationPermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CattleRemoteConfigController>(CattleRemoteConfigController);
  });

  describe('POST diagnostic-mode/enable', () => {
    it('resuelve idCattle → deveui y delega en el service con ttlMinutes opcional', async () => {
      await controller.enableDiagnosticMode('cattle-77', { ttlMinutes: 60 }, session);

      expect(cattleDeviceHistoryRepo.findActiveByCattle).toHaveBeenCalledWith(
        'tenant-1',
        'cattle-77',
      );
      expect(deviceRepo.findByIdAndTenantId).toHaveBeenCalledWith('dev-1', 'tenant-1');
      expect(remoteConfig.enableDiagnosticMode).toHaveBeenCalledWith({
        deveui: '11AA22BB',
        idTenant: 'tenant-1',
        idUser: 'user-1',
        ttlMinutes: 60,
      });
    });

    it('cuando el cattle no tiene device asignado lanza NotFoundException', async () => {
      cattleDeviceHistoryRepo.findActiveByCattle.mockResolvedValue(null);
      await expect(
        controller.enableDiagnosticMode('cattle-orphan', undefined, session),
      ).rejects.toThrow(NotFoundException);
      expect(remoteConfig.enableDiagnosticMode).not.toHaveBeenCalled();
    });
  });

  describe('POST diagnostic-mode/disable', () => {
    it('resuelve idCattle → deveui y delega con triggeredBy="user"', async () => {
      await controller.disableDiagnosticMode('cattle-77', session);

      expect(remoteConfig.disableDiagnosticMode).toHaveBeenCalledWith({
        deveui: '11AA22BB',
        idTenant: 'tenant-1',
        idUser: 'user-1',
        triggeredBy: 'user',
      });
    });

    it('cattle sin device → 404 sin tocar el service', async () => {
      cattleDeviceHistoryRepo.findActiveByCattle.mockResolvedValue(null);
      await expect(controller.disableDiagnosticMode('cattle-orphan', session)).rejects.toThrow(
        NotFoundException,
      );
      expect(remoteConfig.disableDiagnosticMode).not.toHaveBeenCalled();
    });
  });
});
