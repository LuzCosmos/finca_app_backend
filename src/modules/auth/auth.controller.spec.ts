import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { SessionUserDto } from './dto/session-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    validateUser: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      validateUser: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('valida usuario y devuelve el resultado de login', async () => {
      const user = { id: 'u1', username: 'alice' } as never;
      const tokens = { access_token: 'at', user };
      authService.validateUser.mockResolvedValue(user);
      authService.login.mockResolvedValue(tokens);

      const result = await controller.login({
        username: 'alice',
        company_username: 'acme',
        password: 'secret',
      });

      expect(authService.validateUser).toHaveBeenCalledWith('alice', 'acme', 'secret');
      expect(authService.login).toHaveBeenCalledWith(user);
      expect(result).toBe(tokens);
    });

    it('propaga errores de validateUser', async () => {
      authService.validateUser.mockRejectedValue(new UnauthorizedException('bad'));

      await expect(
        controller.login({
          username: 'a',
          company_username: 'c',
          password: 'p',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('propaga errores de authService.login después de validar usuario', async () => {
      const user = { id: 'u1', username: 'alice' } as never;

      authService.validateUser.mockResolvedValue(user);
      authService.login.mockRejectedValue(new Error('token error'));

      await expect(
        controller.login({
          username: 'alice',
          company_username: 'acme',
          password: 'secret',
        }),
      ).rejects.toThrow('token error');

      expect(authService.validateUser).toHaveBeenCalledWith('alice', 'acme', 'secret');
      expect(authService.login).toHaveBeenCalledWith(user);
    });
  });

  describe('refresh', () => {
    it('usa refresh_token (snake_case) y delega en AuthService', async () => {
      const out = { access_token: 'new' };
      authService.refresh.mockResolvedValue(out);

      const result = await controller.refresh({ refresh_token: 'rt-1' });

      expect(authService.refresh).toHaveBeenCalledWith('rt-1');
      expect(result).toBe(out);
    });

    it('usa refreshToken (camelCase)', async () => {
      authService.refresh.mockResolvedValue({});

      await controller.refresh({ refreshToken: 'rt-camel' });

      expect(authService.refresh).toHaveBeenCalledWith('rt-camel');
    });

    it('prefiere refresh_token sobre refreshToken cuando ambos existen', async () => {
      authService.refresh.mockResolvedValue({ access_token: 'new-token' });

      await controller.refresh({
        refresh_token: 'snake-token',
        refreshToken: 'camel-token',
      });

      expect(authService.refresh).toHaveBeenCalledWith('snake-token');
    });

    it('lanza UnauthorizedException si no hay token en el body', async () => {
      await expect(controller.refresh({})).rejects.toThrow(
        new UnauthorizedException('Refresh token is required'),
      );
      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('lanza UnauthorizedException si refresh_token es string vacío', async () => {
      await expect(controller.refresh({ refresh_token: '' })).rejects.toThrow(
        new UnauthorizedException('Refresh token is required'),
      );

      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('lanza UnauthorizedException si refresh_token solo tiene espacios', async () => {
      await expect(controller.refresh({ refresh_token: '   ' })).rejects.toThrow(
        new UnauthorizedException('Refresh token is required'),
      );

      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('hace trim del refresh token antes de delegar', async () => {
      authService.refresh.mockResolvedValue({ access_token: 'new' });

      await controller.refresh({ refresh_token: '  rt-1  ' });

      expect(authService.refresh).toHaveBeenCalledWith('rt-1');
    });

    it('propaga errores de authService.refresh', async () => {
      authService.refresh.mockRejectedValue(new UnauthorizedException('Invalid refresh token'));

      await expect(
        controller.refresh({ refresh_token: 'bad-refresh-token' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(authService.refresh).toHaveBeenCalledWith('bad-refresh-token');
    });
  });

  describe('logout', () => {
    it('delega en AuthService con sub, sessionId y refresh_token', async () => {
      authService.logout.mockResolvedValue({ ok: true });
      const user: SessionUserDto = {
        username: 'alice',
        sub: 'user-1',
        tenant_id: 't1',
        date: '2025-01-01',
        permissionsHash: 'h',
        permissions: {},
        sessionId: 'sess-1',
      };

      const result = await controller.logout(user, { refresh_token: 'rt-x' });

      expect(authService.logout).toHaveBeenCalledWith('user-1', 'sess-1', 'rt-x');
      expect(result).toEqual({ ok: true });
    });

    it('delega logout con refreshToken undefined si body no trae refresh_token', async () => {
      authService.logout.mockResolvedValue({ message: 'Session closed' });

      const user: SessionUserDto = {
        username: 'alice',
        sub: 'user-1',
        tenant_id: 't1',
        date: '2025-01-01',
        permissionsHash: 'h',
        permissions: {},
        sessionId: 'sess-1',
      };

      const result = await controller.logout(user, {} as never);

      expect(authService.logout).toHaveBeenCalledWith('user-1', 'sess-1', undefined);
      expect(result).toEqual({ message: 'Session closed' });
    });

    it('propaga errores de authService.logout', async () => {
      authService.logout.mockRejectedValue(new Error('redis error'));

      const user: SessionUserDto = {
        username: 'alice',
        sub: 'user-1',
        tenant_id: 't1',
        date: '2025-01-01',
        permissionsHash: 'h',
        permissions: {},
        sessionId: 'sess-1',
      };

      await expect(controller.logout(user, { refresh_token: 'rt' })).rejects.toThrow('redis error');
    });
  });

  describe('metadata', () => {
    it('logout declara JwtAuthGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.logout);
      expect(guards).toContain(JwtAuthGuard);
    });
  });
});
