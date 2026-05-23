import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../../employee-management/services/users.service';
import { ApplicationPermissionsService } from '../../../common/application-permissions/application-permissions.service';
import { RoleModulePermissionService } from '../../employee-management/services/role-module-permission.services';
import { User } from '../../employee-management/entities/user.entity';
import { Role } from '../../employee-management/entities/role.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByUsernameAndPasswordAndCompanyUsername: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let applicationPermissionsService: {
    saveSessionData: jest.Mock;
    saveRefreshToken: jest.Mock;
    computePermissionsHash: jest.Mock;
    getSimplefiedModulePermissionsByRolesAndModuleAndTenant: jest.Mock;
    getRefreshTokenData: jest.Mock;
    getSessionFromRedis: jest.Mock;
    deleteRefreshToken: jest.Mock;
    deleteUserSession: jest.Mock;
    deleteRefreshTokenBySession: jest.Mock;
  };
  let roleModulePermissionService: { getByRolesAndTenant: jest.Mock };
  let configService: { get: jest.Mock };

  const tenantId = 'tenant-uuid';
  const permissionsMap = { EMP_MGMT: { users: '11111' } };
  const user: User = {
    id: 'user-uuid',
    username: 'alice',
    password: 'hashed',
    active: true,
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.c',
    tenantId,
    roles: [{ id: 'role-1' } as Role],
    tenant: undefined as any,
  };

  beforeEach(async () => {
    usersService = {
      findByUsernameAndPasswordAndCompanyUsername: jest.fn(),
    };
    jwtService = { sign: jest.fn().mockReturnValue('access.jwt.token') };
    applicationPermissionsService = {
      saveSessionData: jest.fn().mockResolvedValue(undefined),
      saveRefreshToken: jest.fn().mockResolvedValue(undefined),
      computePermissionsHash: jest.fn().mockReturnValue('perm-hash-hex'),
      getSimplefiedModulePermissionsByRolesAndModuleAndTenant: jest
        .fn()
        .mockReturnValue(permissionsMap),
      getRefreshTokenData: jest.fn(),
      getSessionFromRedis: jest.fn(),
      deleteRefreshToken: jest.fn().mockResolvedValue(undefined),
      deleteUserSession: jest.fn().mockResolvedValue(undefined),
      deleteRefreshTokenBySession: jest.fn().mockResolvedValue(undefined),
    };
    roleModulePermissionService = {
      getByRolesAndTenant: jest.fn().mockResolvedValue([]),
    };
    configService = { get: jest.fn().mockImplementation((k: string) => (k === 'JWT_EXPIRATION' ? '1h' : undefined)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ApplicationPermissionsService, useValue: applicationPermissionsService },
        { provide: RoleModulePermissionService, useValue: roleModulePermissionService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('validateUser', () => {
    it('retorna el usuario cuando las credenciales son válidas', async () => {
      usersService.findByUsernameAndPasswordAndCompanyUsername.mockResolvedValue(user);

      const result = await service.validateUser('alice', 'acme', 'secret');

      expect(result).toBe(user);
      expect(usersService.findByUsernameAndPasswordAndCompanyUsername).toHaveBeenCalledWith(
        'alice',
        'secret',
        'acme',
      );
    });

    it('lanza UnauthorizedException cuando no hay usuario', async () => {
      usersService.findByUsernameAndPasswordAndCompanyUsername.mockResolvedValue(null);

      await expect(service.validateUser('alice', 'acme', 'bad')).rejects.toThrow(UnauthorizedException);
    });

    it('propaga errores del UsersService', async () => {
      usersService.findByUsernameAndPasswordAndCompanyUsername.mockRejectedValue(
        new Error('DB unavailable'),
      );

      await expect(service.validateUser('alice', 'acme', 'secret')).rejects.toThrow('DB unavailable');
    });
  });

  describe('login', () => {
    it('persiste sesión, firma access token y guarda refresh token con estructura esperada', async () => {
      const result = await service.login(user);

      expect(roleModulePermissionService.getByRolesAndTenant).toHaveBeenCalledWith(['role-1'], tenantId);
      expect(applicationPermissionsService.computePermissionsHash).toHaveBeenCalledWith(permissionsMap);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          username: user.username,
          sub: user.id,
          tenant_id: user.tenantId,
          permissionsHash: 'perm-hash-hex',
          sessionId: expect.any(String),
        }),
      );

      expect(applicationPermissionsService.saveSessionData).toHaveBeenCalledWith(
        user.id,
        expect.any(String),
        expect.objectContaining({
          username: user.username,
          sub: user.id,
          tenant_id: user.tenantId,
          permissionsHash: 'perm-hash-hex',
          permissions: permissionsMap,
          sessionId: expect.any(String),
        }),
      );

      expect(applicationPermissionsService.saveRefreshToken).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-f0-9]{96}$/),
        user.id,
        expect.any(String),
      );

      expect(result.access_token).toBe('access.jwt.token');
      expect(result.refresh_token).toHaveLength(96);
      expect(result.user.id).toBe(user.id);
      expect(result.expires_in).toBe(3600);

      const saveSessionCall = applicationPermissionsService.saveSessionData.mock.calls[0];
      const jwtPayload = jwtService.sign.mock.calls[0][0];
      const saveRefreshCall = applicationPermissionsService.saveRefreshToken.mock.calls[0];

      const sessionIdFromSaveSessionArg = saveSessionCall[1];
      const sessionIdFromSessionData = saveSessionCall[2].sessionId;
      const sessionIdFromJwt = jwtPayload.sessionId;
      const sessionIdFromRefresh = saveRefreshCall[2];

      expect(sessionIdFromSessionData).toBe(sessionIdFromSaveSessionArg);
      expect(sessionIdFromJwt).toBe(sessionIdFromSaveSessionArg);
      expect(sessionIdFromRefresh).toBe(sessionIdFromSaveSessionArg);
    });

    it.each([
      ['30m', 1800],
      ['2h', 7200],
      ['1d', 86400],
      [undefined, 86400],
      ['invalid', 86400],
    ] as const)(
      'cuando JWT_EXPIRATION es %j entonces expires_in es %p',
      async (rawExpiration, expectedSeconds) => {
        configService.get.mockImplementation((key: string) =>
          key === 'JWT_EXPIRATION' ? rawExpiration : undefined,
        );

        const result = await service.login(user);

        expect(result.expires_in).toBe(expectedSeconds);
      },
    );

    it('inicia sesión con usuario sin roles llamando getByRolesAndTenant con []', async () => {
      const userWithoutRoles = { ...user, roles: [] };

      const result = await service.login(userWithoutRoles as User);

      expect(roleModulePermissionService.getByRolesAndTenant).toHaveBeenCalledWith([], tenantId);
      expect(result.access_token).toBe('access.jwt.token');
    });
  });

  describe('refresh', () => {
    const sessionData = {
      username: user.username,
      sub: user.id,
      tenant_id: tenantId,
      permissionsHash: 'hash',
      permissions: permissionsMap,
      sessionId: 'sess-1',
    };

    it('rechaza refresh token vacío', async () => {
      await expect(service.refresh('')).rejects.toThrow(UnauthorizedException);
    });

    it('rota tokens y devuelve permisos de la sesión Redis', async () => {
      applicationPermissionsService.getRefreshTokenData.mockResolvedValue({
        userId: user.id,
        sessionId: 'sess-1',
      });
      applicationPermissionsService.getSessionFromRedis.mockResolvedValue(sessionData);
      configService.get.mockImplementation((k: string) => (k === 'JWT_EXPIRATION' ? '1h' : undefined));

      const out = await service.refresh('refresh-hex');

      expect(applicationPermissionsService.getRefreshTokenData).toHaveBeenCalledWith('refresh-hex');
      expect(applicationPermissionsService.getSessionFromRedis).toHaveBeenCalledWith(
        user.id,
        'sess-1',
      );
      expect(applicationPermissionsService.deleteRefreshToken).toHaveBeenCalledWith('refresh-hex');
      expect(applicationPermissionsService.saveRefreshToken).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-f0-9]{96}$/),
        user.id,
        'sess-1',
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          username: user.username,
          sub: user.id,
          tenant_id: tenantId,
          permissionsHash: 'hash',
          sessionId: 'sess-1',
        }),
      );
      expect(out.access_token).toBe('access.jwt.token');
      expect(out.refresh_token).toHaveLength(96);
      expect(out.expires_in).toBe(3600);
      expect(out.permissions).toEqual(sessionData.permissions);
    });

    it('elimina refresh y lanza si la sesión Redis expiró', async () => {
      applicationPermissionsService.getRefreshTokenData.mockResolvedValue({
        userId: user.id,
        sessionId: 'sess-1',
      });
      applicationPermissionsService.getSessionFromRedis.mockResolvedValue(null);

      await expect(service.refresh('refresh-hex')).rejects.toThrow(UnauthorizedException);

      expect(applicationPermissionsService.deleteRefreshToken).toHaveBeenCalledWith('refresh-hex');
    });

    it('lanza si el refresh token no existe', async () => {
      applicationPermissionsService.getRefreshTokenData.mockResolvedValue(null);

      await expect(service.refresh('bad')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('elimina sesión y refresh por sesión; sin refresh token opcional no llama deleteRefreshToken', async () => {
      await service.logout(user.id, 'sess-1');

      expect(applicationPermissionsService.deleteUserSession).toHaveBeenCalledWith(user.id, 'sess-1');
      expect(applicationPermissionsService.deleteRefreshTokenBySession).toHaveBeenCalledWith(
        user.id,
        'sess-1',
      );
      expect(applicationPermissionsService.deleteRefreshToken).not.toHaveBeenCalled();
    });

    it('con refresh token opcional también llama deleteRefreshToken', async () => {
      await service.logout(user.id, 'sess-1', 'rt');

      expect(applicationPermissionsService.deleteUserSession).toHaveBeenCalledWith(user.id, 'sess-1');
      expect(applicationPermissionsService.deleteRefreshTokenBySession).toHaveBeenCalledWith(
        user.id,
        'sess-1',
      );
      expect(applicationPermissionsService.deleteRefreshToken).toHaveBeenCalledWith('rt');
    });

    it('devuelve mensaje de sesión cerrada', async () => {
      const result = await service.logout(user.id, 'sess-1', 'rt');

      expect(result).toEqual({ message: 'Session closed' });
    });
  });
});
