import { Test, TestingModule } from '@nestjs/testing';
import { DeviceRemoteConfigController } from './device-remote-config.controller';
import { DeviceRemoteConfigurationService } from '../services/device-remote-configuration.service';
import { DeviceDownlinkCommandRepository } from '../repositories/device-downlink-command.repository';
import { DeviceRepository } from '../repositories/device.repository';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from '../../../common/application-permissions/application-permissions.guard';
import { SessionUserDto } from '../../auth/dto/session-user.dto';

/**
 * Spec dedicado a los endpoints `diagnostic-mode/{enable,disable}` del controller
 * por DevEUI. Cubre:
 *  - Que el controller delega correctamente en `DeviceRemoteConfigurationService`.
 *  - Que pasa `idTenant`, `idUser` y el `ttlMinutes` opcional como vienen del request.
 *  - Que `disable` SIEMPRE viaja con `triggeredBy='user'` (necesario para distinguir
 *    de la auto-restauración del cron en logs y métricas).
 *  - Que ambos endpoints responden `202 Accepted` (verificado vía decoradores HTTP
 *    en otros tests de la suite, aquí validamos solo el contrato del método).
 *
 * NO cubre el guard de permisos: como en el resto de specs del módulo, se overridea
 * con `canActivate: () => true`. La verificación de RBAC vive en
 * `application-permissions.service.spec.ts`.
 */
describe('DeviceRemoteConfigController · diagnostic-mode', () => {
  const session: SessionUserDto = {
    username: 'admin',
    sub: 'user-1',
    tenant_id: 'tenant-1',
    date: '2025-01-01',
    permissionsHash: 'h',
    permissions: {},
    sessionId: 'sess-1',
  };

  let controller: DeviceRemoteConfigController;
  let remoteConfig: { enableDiagnosticMode: jest.Mock; disableDiagnosticMode: jest.Mock };

  beforeEach(async () => {
    remoteConfig = {
      enableDiagnosticMode: jest
        .fn()
        .mockResolvedValue({ command: { id: 'c-enable' }, diagnosticState: { ttlMinutes: 30 } }),
      disableDiagnosticMode: jest
        .fn()
        .mockResolvedValue({ command: { id: 'c-disable' }, restoredFrom: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeviceRemoteConfigController],
      providers: [
        { provide: DeviceRemoteConfigurationService, useValue: remoteConfig },
        { provide: DeviceDownlinkCommandRepository, useValue: {} },
        { provide: DeviceRepository, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ApplicationPermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DeviceRemoteConfigController>(DeviceRemoteConfigController);
  });

  describe('POST diagnostic-mode/enable', () => {
    it('delega en service.enableDiagnosticMode con idTenant e idUser de la sesión', async () => {
      const out = await controller.enableDiagnosticMode('11AA', undefined, session);
      expect(remoteConfig.enableDiagnosticMode).toHaveBeenCalledWith({
        deveui: '11AA',
        idTenant: 'tenant-1',
        idUser: 'user-1',
        ttlMinutes: undefined,
      });
      expect(out).toEqual({
        command: { id: 'c-enable' },
        diagnosticState: { ttlMinutes: 30 },
      });
    });

    it('propaga `ttlMinutes` cuando viene en el body', async () => {
      await controller.enableDiagnosticMode('11AA', { ttlMinutes: 90 }, session);
      expect(remoteConfig.enableDiagnosticMode).toHaveBeenCalledWith({
        deveui: '11AA',
        idTenant: 'tenant-1',
        idUser: 'user-1',
        ttlMinutes: 90,
      });
    });

    it('si el body es {} no envía ttlMinutes (aplican defaults del service)', async () => {
      await controller.enableDiagnosticMode('11AA', {}, session);
      expect(remoteConfig.enableDiagnosticMode).toHaveBeenCalledWith(
        expect.objectContaining({ ttlMinutes: undefined }),
      );
    });
  });

  describe('POST diagnostic-mode/disable', () => {
    it('delega en service.disableDiagnosticMode con triggeredBy="user"', async () => {
      const out = await controller.disableDiagnosticMode('11AA', session);
      expect(remoteConfig.disableDiagnosticMode).toHaveBeenCalledWith({
        deveui: '11AA',
        idTenant: 'tenant-1',
        idUser: 'user-1',
        triggeredBy: 'user',
      });
      expect(out).toEqual({ command: { id: 'c-disable' }, restoredFrom: null });
    });
  });
});
