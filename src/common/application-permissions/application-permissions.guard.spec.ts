import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApplicationPermissionsGuard } from './application-permissions.guard';
import { ApplicationPermissionsService } from './application-permissions.service';

function createExecutionContext(overrides: {
  user?: { sub?: string; sessionId?: string; permissionsHash?: string } | null;
  method?: string;
  url?: string;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  handler?: Function;
  controllerClass?: Function;
}): ExecutionContext {
  const {
    user = { sub: 'user-1', sessionId: 'sess-1', permissionsHash: 'hash-a' },
    method = 'GET',
    url = '/devices',
    body = {},
    params = {},
    handler = jest.fn(),
    controllerClass = class TestController {},
  } = overrides;

  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, method, url, path: url, body, params }),
    }),
    getHandler: () => handler,
    getClass: () => controllerClass,
  } as unknown as ExecutionContext;
}

describe('ApplicationPermissionsGuard', () => {
  let guard: ApplicationPermissionsGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'get'>>;
  let permissionsService: jest.Mocked<
    Pick<ApplicationPermissionsService, 'getSessionFromRedis' | 'canAccessModuleEntity'>
  >;

  beforeEach(() => {
    reflector = { get: jest.fn() };
    permissionsService = {
      getSessionFromRedis: jest.fn(),
      canAccessModuleEntity: jest.fn(),
    };
    guard = new ApplicationPermissionsGuard(
      reflector as unknown as Reflector,
      permissionsService as unknown as ApplicationPermissionsService,
    );
  });

  const stubDecorators = (module: string, entity: string, action: string) => {
    reflector.get.mockImplementation((key: string) => {
      if (key === 'requireModule') return module;
      if (key === 'requireEntity') return entity;
      if (key === 'requireAction') return action;
      return undefined;
    });
  };

  describe('autenticación', () => {
    it('rechaza si no hay usuario en el request', async () => {
      const ctx = createExecutionContext({ user: null });
      stubDecorators('PROD_CENTER', 'devices', 'list');

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('metadatos', () => {
    it('rechaza si faltan metadatos de módulo/entidad/acción', async () => {
      reflector.get.mockReturnValue(undefined);
      const ctx = createExecutionContext({});

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('resuelve requireModule y requireEntity desde la clase si faltan en el handler; requireAction solo desde el handler', async () => {
      const handler = jest.fn();
      const controllerClass = class TestController {};

      const ctx = createExecutionContext({
        user: { sub: 'u1', sessionId: 's1', permissionsHash: 'hash-a' },
        handler,
        controllerClass,
      });

      reflector.get.mockImplementation((key: string, target: unknown) => {
        if (key === 'requireAction' && target === handler) return 'list';
        if (target === handler) return undefined;
        if (target === controllerClass && key === 'requireModule') return 'PROD_CENTER';
        if (target === controllerClass && key === 'requireEntity') return 'devices';
        return undefined;
      });

      permissionsService.getSessionFromRedis.mockResolvedValue({
        permissionsHash: 'hash-a',
        permissions: { PROD_CENTER: { devices: '00001' } },
      } as any);

      permissionsService.canAccessModuleEntity.mockResolvedValue(true);

      await expect(guard.canActivate(ctx)).resolves.toBe(true);

      expect(reflector.get).toHaveBeenCalledWith('requireModule', handler);
      expect(reflector.get).toHaveBeenCalledWith('requireModule', controllerClass);
      expect(reflector.get).toHaveBeenCalledWith('requireEntity', handler);
      expect(reflector.get).toHaveBeenCalledWith('requireEntity', controllerClass);
      expect(reflector.get).toHaveBeenCalledWith('requireAction', handler);
      expect(reflector.get).not.toHaveBeenCalledWith('requireAction', controllerClass);

      expect(permissionsService.getSessionFromRedis).toHaveBeenCalledWith('u1', 's1');
    });

    it('lanza ForbiddenException si requireAction no está en el handler aunque module y entity vengan de la clase', async () => {
      const handler = jest.fn();
      const controllerClass = class TestController {};

      const ctx = createExecutionContext({
        user: { sub: 'u1', sessionId: 's1', permissionsHash: 'hash-a' },
        handler,
        controllerClass,
      });

      reflector.get.mockImplementation((key: string, target: unknown) => {
        if (target === handler) return undefined;
        if (target === controllerClass && key === 'requireModule') return 'PROD_CENTER';
        if (target === controllerClass && key === 'requireEntity') return 'devices';
        if (target === controllerClass && key === 'requireAction') return 'list';
        return undefined;
      });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);

      expect(reflector.get).toHaveBeenCalledWith('requireAction', handler);
      expect(reflector.get).not.toHaveBeenCalledWith('requireAction', controllerClass);
      expect(permissionsService.getSessionFromRedis).not.toHaveBeenCalled();
    });
  });

  describe('restricciones fijas (roles / modules)', () => {
    it.each([
      ['create', 'roles'],
      ['update', 'roles'],
      ['delete', 'roles'],
      ['create', 'modules'],
      ['update', 'modules'],
      ['delete', 'modules'],
    ] as const)('rechaza %s sobre %s sin consultar Redis', async (action, entity) => {
      const ctx = createExecutionContext({});
      stubDecorators('EMP_MGMT', entity, action);

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      expect(permissionsService.getSessionFromRedis).not.toHaveBeenCalled();
    });
  });

  describe('excepciones tenant', () => {
    it('permite create de tenants sin consultar Redis', async () => {
      const ctx = createExecutionContext({});
      stubDecorators('EMP_MGMT', 'tenants', 'create');

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(permissionsService.getSessionFromRedis).not.toHaveBeenCalled();
    });

    // Mejora posible (producto): lanzar ForbiddenException en lugar de `return false`
    // para alinear el rechazo de tenants/list con el resto del guard.
    it('devuelve false al listar tenants sin consultar Redis', async () => {
      const ctx = createExecutionContext({});
      stubDecorators('EMP_MGMT', 'tenants', 'list');

      await expect(guard.canActivate(ctx)).resolves.toBe(false);
      expect(permissionsService.getSessionFromRedis).not.toHaveBeenCalled();
    });
  });

  describe('validación de sesión Redis', () => {
    it('rechaza si no hay sesión en Redis', async () => {
      stubDecorators('PROD_CENTER', 'devices', 'list');
      const ctx = createExecutionContext({ user: { sub: 'u1', sessionId: 's1', permissionsHash: 'hash-a' } });

      permissionsService.getSessionFromRedis.mockResolvedValue(null);

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('rechaza si el hash de permisos no coincide con el JWT', async () => {
      stubDecorators('PROD_CENTER', 'devices', 'list');
      const ctx = createExecutionContext({ user: { sub: 'u1', sessionId: 's1', permissionsHash: 'hash-a' } });

      permissionsService.getSessionFromRedis.mockResolvedValue({
        permissionsHash: 'otro',
        permissions: { PROD_CENTER: { devices: '00001' } },
      } as any);

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('rechaza si la sesión Redis no incluye objeto permissions', async () => {
      stubDecorators('PROD_CENTER', 'devices', 'list');

      const ctx = createExecutionContext({
        user: { sub: 'u1', sessionId: 's1', permissionsHash: 'hash-a' },
      });

      permissionsService.getSessionFromRedis.mockResolvedValue({
        permissionsHash: 'hash-a',
      } as any);

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('evaluación de permisos', () => {
    it('permite cuando Redis y canAccessModuleEntity autorizan', async () => {
      stubDecorators('PROD_CENTER', 'devices', 'list');
      const ctx = createExecutionContext({ user: { sub: 'u1', sessionId: 's1', permissionsHash: 'hash-a' } });

      permissionsService.getSessionFromRedis.mockResolvedValue({
        permissionsHash: 'hash-a',
        permissions: { PROD_CENTER: { devices: '00001' } },
      } as any);
      permissionsService.canAccessModuleEntity.mockResolvedValue(true);

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(permissionsService.getSessionFromRedis).toHaveBeenCalledWith('u1', 's1');
      expect(permissionsService.canAccessModuleEntity).toHaveBeenCalledWith(
        'PROD_CENTER',
        'devices',
        'list',
        { PROD_CENTER: { devices: '00001' } },
      );
    });

    it('rechaza cuando canAccessModuleEntity devuelve false', async () => {
      stubDecorators('PROD_CENTER', 'devices', 'delete');

      const ctx = createExecutionContext({
        user: { sub: 'u1', sessionId: 's1', permissionsHash: 'hash-a' },
      });

      permissionsService.getSessionFromRedis.mockResolvedValue({
        permissionsHash: 'hash-a',
        permissions: { PROD_CENTER: { devices: '00001' } },
      } as any);

      permissionsService.canAccessModuleEntity.mockResolvedValue(false);

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('auto-actualización de usuario (campos no restringidos)', () => {
    it('permite actualizar campos no restringidos del propio usuario sin permiso completo', async () => {
      stubDecorators('EMP_MGMT', 'users', 'update');

      const ctx = createExecutionContext({
        user: { sub: 'u1', sessionId: 's1', permissionsHash: 'hash-a' },
        params: { id: 'u1' },
        body: { firstName: 'Nuevo nombre' },
      });

      permissionsService.getSessionFromRedis.mockResolvedValue({
        permissionsHash: 'hash-a',
        permissions: { EMP_MGMT: { users: '00000' } },
      } as any);

      permissionsService.canAccessModuleEntity.mockResolvedValue(false);

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it.each([
      [{ roleIds: ['admin'] }],
      [{ tenantId: 'other-tenant' }],
      [{ active: false }],
    ])('rechaza si el propio usuario envía campos restringidos: %j', async (body) => {
      stubDecorators('EMP_MGMT', 'users', 'update');

      const ctx = createExecutionContext({
        user: { sub: 'u1', sessionId: 's1', permissionsHash: 'hash-a' },
        params: { id: 'u1' },
        body,
      });

      permissionsService.getSessionFromRedis.mockResolvedValue({
        permissionsHash: 'hash-a',
        permissions: { EMP_MGMT: { users: '00000' } },
      } as any);

      permissionsService.canAccessModuleEntity.mockResolvedValue(false);

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('rechaza actualizar otro usuario sin permiso', async () => {
      stubDecorators('EMP_MGMT', 'users', 'update');

      const ctx = createExecutionContext({
        user: { sub: 'u1', sessionId: 's1', permissionsHash: 'hash-a' },
        params: { id: 'u2' },
        body: { firstName: 'Nuevo nombre' },
      });

      permissionsService.getSessionFromRedis.mockResolvedValue({
        permissionsHash: 'hash-a',
        permissions: { EMP_MGMT: { users: '00000' } },
      } as any);

      permissionsService.canAccessModuleEntity.mockResolvedValue(false);

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });
});
