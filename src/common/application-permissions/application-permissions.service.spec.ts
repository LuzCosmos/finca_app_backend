import { ConfigService } from '@nestjs/config';
import { ApplicationPermissionsService } from './application-permissions.service';
import { RedisService } from 'src/modules/auth/redis/redis.service';

describe('ApplicationPermissionsService.normalizeCrudlMask', () => {
  it('expande máscara legada de dos bits "11" a read+update (01100)', () => {
    expect(ApplicationPermissionsService.normalizeCrudlMask('11')).toBe('01100');
  });

  it('deja máscaras de 5 bits binarias intactas', () => {
    expect(ApplicationPermissionsService.normalizeCrudlMask('01100')).toBe('01100');
    expect(ApplicationPermissionsService.normalizeCrudlMask('11111')).toBe('11111');
  });

  it('equivalente a plantilla 0RU00 tras replace del módulo ([^0]→1)', () => {
    expect(ApplicationPermissionsService.normalizeCrudlMask('0RU00'.replace(/[^0]/g, '1'))).toBe(
      '01100',
    );
  });
});

describe('ApplicationPermissionsService.canAccessModuleEntity', () => {
  let service: ApplicationPermissionsService;

  beforeEach(() => {
    service = new ApplicationPermissionsService(
      {} as RedisService,
      { get: jest.fn() } as unknown as ConfigService,
    );
  });

  it('permite read y update con máscara JWT legada "11" en remote_config', async () => {
    const permissions = { PROD_CENTER: { remote_config: '11' } };
    await expect(
      service.canAccessModuleEntity('PROD_CENTER', 'remote_config', 'read', permissions),
    ).resolves.toBe(true);
    await expect(
      service.canAccessModuleEntity('PROD_CENTER', 'remote_config', 'update', permissions),
    ).resolves.toBe(true);
    await expect(
      service.canAccessModuleEntity('PROD_CENTER', 'remote_config', 'create', permissions),
    ).resolves.toBe(false);
    await expect(
      service.canAccessModuleEntity('PROD_CENTER', 'remote_config', 'list', permissions),
    ).resolves.toBe(false);
  });
});
