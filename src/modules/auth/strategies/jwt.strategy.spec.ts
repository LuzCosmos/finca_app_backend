import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../employee-management/services/users.service';
import { ApplicationPermissionsService } from '../../../common/application-permissions/application-permissions.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let permissionsService: { getSessionFromRedis: jest.Mock };

  async function createStrategy(): Promise<JwtStrategy> {
    permissionsService = { getSessionFromRedis: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-secret') } },
        { provide: UsersService, useValue: {} },
        { provide: ApplicationPermissionsService, useValue: permissionsService },
      ],
    }).compile();

    return module.get(JwtStrategy);
  }

  beforeEach(async () => {
    strategy = await createStrategy();
  });

  it('validate rechaza payload sin sub', async () => {
    await expect(strategy.validate({})).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza payload null', async () => {
    await expect(strategy.validate(null as any)).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza payload undefined', async () => {
    await expect(strategy.validate(undefined as any)).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza si no hay sesión en Redis', async () => {
    permissionsService.getSessionFromRedis.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'u1', sessionId: 's1', permissionsHash: 'h' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(permissionsService.getSessionFromRedis).toHaveBeenCalledWith('u1', 's1');
  });

  it('llama getSessionFromRedis con sessionId undefined cuando falta en el JWT', async () => {
    permissionsService.getSessionFromRedis.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'u1', permissionsHash: 'hash-a' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(permissionsService.getSessionFromRedis).toHaveBeenCalledWith('u1', undefined);
  });

  it('rechaza si falta permissionsHash en JWT pero Redis tiene hash', async () => {
    permissionsService.getSessionFromRedis.mockResolvedValue({
      permissionsHash: 'hash-a',
      permissions: {},
    });

    await expect(strategy.validate({ sub: 'u1', sessionId: 's1' })).rejects.toThrow(UnauthorizedException);

    expect(permissionsService.getSessionFromRedis).toHaveBeenCalledWith('u1', 's1');
  });

  it('validate rechaza si el hash de permisos no coincide', async () => {
    permissionsService.getSessionFromRedis.mockResolvedValue({
      permissionsHash: 'en-redis',
      permissions: {},
    });

    await expect(
      strategy.validate({ sub: 'u1', sessionId: 's1', permissionsHash: 'en-jwt' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(permissionsService.getSessionFromRedis).toHaveBeenCalledWith('u1', 's1');
  });

  it('validate devuelve sessionData cuando Redis y hash coinciden', async () => {
    const sessionData = {
      permissionsHash: 'mismo',
      permissions: { M: { e: '11111' } },
      sub: 'u1',
      sessionId: 's1',
    };
    permissionsService.getSessionFromRedis.mockResolvedValue(sessionData);

    const out = await strategy.validate({ sub: 'u1', sessionId: 's1', permissionsHash: 'mismo' });

    expect(out).toBe(sessionData);
    expect(permissionsService.getSessionFromRedis).toHaveBeenCalledWith('u1', 's1');
  });

  it('lanza si JWT_SECRET no está configurado', async () => {
    const ps = { getSessionFromRedis: jest.fn() };

    await expect(
      Test.createTestingModule({
        providers: [
          JwtStrategy,
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
          { provide: UsersService, useValue: {} },
          { provide: ApplicationPermissionsService, useValue: ps },
        ],
      }).compile(),
    ).rejects.toThrow('JWT_SECRET no está configurado en las variables de entorno');
  });
});
