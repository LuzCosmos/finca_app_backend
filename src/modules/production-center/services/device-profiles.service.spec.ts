import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DeviceProfilesService } from './device-profiles.service';
import { DeviceProfileRepository } from '../repositories/device-profile.repository';
import { DevicesService } from './devices.service';
import { DeviceProfile } from '../entities/device-profile.entity';
import { CreateDeviceProfileDto } from '../dto/create-device-profile.dto';
import { UpdateDeviceProfileDto } from '../dto/update-device-profile.dto';

describe('DeviceProfilesService', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  let service: DeviceProfilesService;
  let deviceProfileRepository: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    findByNameAndTenantId: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let httpGet: jest.Mock;
  let existChirpstackApplicationId: jest.Mock;

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const profileId = '22222222-2222-2222-2222-222222222222';
  const chirpstackProfileId = '33333333-3333-3333-3333-333333333333';
  const applicationId = '44444444-4444-4444-4444-444444444444';
  const chirpstackUrl = 'http://chirpstack.test';

  const profile: DeviceProfile = {
    id: profileId,
    idTenant: tenantId,
    name: 'LW001 Test',
    description: 'desc',
    idChipstack: chirpstackProfileId,
    csApplicationId: applicationId,
    csJoineui: '1234568b9d55e072',
    csAppKey: 'd4e9f3b27a5c8160f8d2a1943eb7c65f',
    csNwkKey: '000000027a5c8160f8d2a1943eb7c65f',
    fccId: 'FCC',
    regions: 'US915',
    model: 'LW001',
    input: 'default',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as DeviceProfile;

  const baseCreateDto: CreateDeviceProfileDto = {
    idTenant: tenantId,
    name: 'Nuevo perfil',
    description: 'Nuevo',
    idChipstack: chirpstackProfileId,
    csApplicationId: applicationId,
    csJoineui: '1234568b9d55e072',
    csAppKey: 'd4e9f3b27a5c8160f8d2a1943eb7c65f',
    csNwkKey: '000000027a5c8160f8d2a1943eb7c65f',
    fccId: 'FCC-NEW',
    regions: 'US915',
    model: 'LW001',
  };

  beforeEach(async () => {
    httpGet = jest.fn().mockReturnValue(of({ data: { deviceProfile: { id: chirpstackProfileId } } }));
    existChirpstackApplicationId = jest.fn().mockResolvedValue(undefined);

    deviceProfileRepository = {
      create: jest.fn().mockResolvedValue(profile),
      findAll: jest.fn().mockResolvedValue([profile]),
      findOne: jest.fn().mockResolvedValue(profile),
      findByNameAndTenantId: jest.fn().mockRejectedValue(
        new NotFoundException('Device profile with name x not found'),
      ),
      update: jest.fn().mockResolvedValue({ ...profile, description: 'updated' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceProfilesService,
        {
          provide: DeviceProfileRepository,
          useValue: deviceProfileRepository,
        },
        {
          provide: HttpService,
          useValue: { get: httpGet },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CHIRPSTACK_API_URL') {
                return chirpstackUrl;
              }
              if (key === 'CHIRPSTACK_API_KEY') {
                return 'test-token';
              }
              return undefined;
            }),
          },
        },
        {
          provide: DevicesService,
          useValue: { existChirpstackApplicationId },
        },
      ],
    }).compile();

    service = module.get(DeviceProfilesService);
  });

  describe('create', () => {
    it('crea perfil tras validar ChirpStack y aplicación', async () => {
      const result = await service.create(baseCreateDto);
      expect(result).toEqual(profile);
      expect(httpGet).toHaveBeenCalledWith(
        `${chirpstackUrl}/api/device-profiles/${chirpstackProfileId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Grpc-Metadata-Authorization': 'Bearer test-token',
          }),
        }),
      );
      expect(existChirpstackApplicationId).toHaveBeenCalledWith(applicationId);
      expect(deviceProfileRepository.create).toHaveBeenCalledWith(baseCreateDto);
    });

    it('lanza ConflictException si el nombre ya existe en el tenant', async () => {
      deviceProfileRepository.findByNameAndTenantId.mockResolvedValue(profile);
      await expect(service.create(baseCreateDto)).rejects.toBeInstanceOf(ConflictException);
      expect(deviceProfileRepository.create).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si el perfil no existe en ChirpStack (404)', async () => {
      httpGet.mockReturnValue(
        throwError(() => ({ response: { status: 404 } })),
      );
      await expect(service.create(baseCreateDto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findAll / findOne', () => {
    it('findAll devuelve perfiles del tenant', async () => {
      const result = await service.findAll(tenantId);
      expect(result).toEqual([profile]);
      expect(deviceProfileRepository.findAll).toHaveBeenCalledWith(tenantId);
    });

    it('findOne devuelve perfil por id y tenant', async () => {
      const result = await service.findOne(profileId, tenantId);
      expect(result).toEqual(profile);
    });
  });

  describe('update', () => {
    const updateDto: UpdateDeviceProfileDto = {
      idTenant: tenantId,
      description: 'Actualizado',
    };

    it('actualiza descripción sin revalidar ChirpStack si no cambia idChipstack', async () => {
      const result = await service.update(profileId, tenantId, updateDto);
      expect(result.description).toBe('updated');
      expect(httpGet).not.toHaveBeenCalled();
    });

    it('revalida ChirpStack cuando cambia idChipstack', async () => {
      const newChipstackId = '55555555-5555-5555-5555-555555555555';
      await service.update(profileId, tenantId, {
        ...updateDto,
        idChipstack: newChipstackId,
      });
      expect(httpGet).toHaveBeenCalledWith(
        `${chirpstackUrl}/api/device-profiles/${newChipstackId}`,
        expect.any(Object),
      );
    });

    it('lanza ConflictException si el nuevo nombre ya existe en otro perfil', async () => {
      deviceProfileRepository.findByNameAndTenantId.mockResolvedValue({
        ...profile,
        id: '99999999-9999-9999-9999-999999999999',
      });
      await expect(
        service.update(profileId, tenantId, { ...updateDto, name: 'Duplicado' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lanza ForbiddenException si el perfil no pertenece al tenant', async () => {
      deviceProfileRepository.findOne.mockRejectedValue(
        new NotFoundException(`Device profile with ID ${profileId} not found`),
      );
      await expect(service.update(profileId, tenantId, updateDto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('elimina perfil del tenant', async () => {
      await service.remove(profileId, tenantId);
      expect(deviceProfileRepository.remove).toHaveBeenCalledWith(profileId);
    });

    it('lanza ForbiddenException si el perfil no pertenece al tenant', async () => {
      deviceProfileRepository.findOne.mockRejectedValue(
        new NotFoundException(`Device profile with ID ${profileId} not found`),
      );
      await expect(service.remove(profileId, tenantId)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
