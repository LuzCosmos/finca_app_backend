import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DeviceRepository } from '../repositories/device.repository';
import { DeviceProfileRepository } from '../repositories/device-profile.repository';
import { Device } from '../entities/device.entity';
import { DeviceProfile } from '../entities/device-profile.entity';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import {
  ChirpstackDeviceInterface,
  ChirpstackDeviceKeysInterface,
} from '../interfaces/chirpstack-device.interface';

describe('DevicesService', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  let service: DevicesService;
  let deviceRepository: {
    findByIdAndTenantId: jest.Mock;
    findByDevEuiAndTenantId: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let deviceProfileRepository: { findOne: jest.Mock };
  let httpGet: jest.Mock;
  let httpPost: jest.Mock;
  let httpPut: jest.Mock;
  let httpDelete: jest.Mock;
  let httpServiceGet: jest.Mock;

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const deviceId = '22222222-2222-2222-2222-222222222222';
  const profileId = '33333333-3333-3333-3333-333333333333';
  const chirpstackProfileId = '44444444-4444-4444-4444-444444444444';
  const applicationId = '55555555-5555-5555-5555-555555555555';

  const deviceProfile: DeviceProfile = {
    id: profileId,
    idTenant: tenantId,
    name: 'LW001',
    description: 'Perfil test',
    idChipstack: chirpstackProfileId,
    csApplicationId: applicationId,
    csJoineui: '0000000000000001',
    csAppKey: '00000000000000000000000000000001',
    csNwkKey: '00000000000000000000000000000002',
    fccId: 'FCC-TEST',
    regions: 'EU868',
    model: 'LW001',
    input: 'default',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as DeviceProfile;

  const device = {
    id: deviceId,
    deveui: '0102030405060708',
    idTenant: tenantId,
    idDeviceProfile: profileId,
    name: 'Sensor 1',
    description: 'desc',
    tags: {},
    variables: {},
    idChirpstackProfile: chirpstackProfileId,
    csApplicationId: applicationId,
    csJoineui: '0000000000000001',
    csAppKey: '00000000000000000000000000000001',
    csNwkKey: '00000000000000000000000000000002',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Device;

  const baseCreateDto: CreateDeviceDto = {
    idTenant: tenantId,
    idDeviceProfile: profileId,
    deveui: '0102030405060708',
    name: 'Sensor nuevo',
    description: 'Nuevo dispositivo',
    csApplicationId: applicationId,
    tags: {},
    variables: {},
  };

  const chirpstackDevice: ChirpstackDeviceInterface = {
    applicationId,
    description: baseCreateDto.description,
    devEui: baseCreateDto.deveui,
    deviceProfileId: chirpstackProfileId,
    isDisabled: false,
    joinEui: deviceProfile.csJoineui,
    name: baseCreateDto.name,
    skipFcntCheck: false,
    tags: {},
    variables: {},
  };

  const deviceKeys: ChirpstackDeviceKeysInterface = {
    appKey: deviceProfile.csAppKey,
    nwkKey: deviceProfile.csNwkKey,
  };

  const chirpstackHeaders = expect.objectContaining({
    accept: 'application/json',
    'Grpc-Metadata-Authorization': 'Bearer test-token',
  });

  beforeEach(async () => {
    deviceRepository = {
      findByIdAndTenantId: jest.fn(),
      findByDevEuiAndTenantId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    deviceProfileRepository = { findOne: jest.fn() };
    httpGet = jest.fn();
    httpPost = jest.fn();
    httpPut = jest.fn();
    httpDelete = jest.fn();
    httpServiceGet = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: DeviceRepository, useValue: deviceRepository },
        { provide: DeviceProfileRepository, useValue: deviceProfileRepository },
        {
          provide: HttpService,
          useValue: {
            axiosRef: { get: httpGet, post: httpPost, put: httpPut, delete: httpDelete },
            get: httpServiceGet,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'CHIRPSTACK_API_URL' ? 'https://chirpstack.test' : 'test-token',
            ),
          },
        },
      ],
    }).compile();

    service = module.get(DevicesService);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('lanza si faltan CHIRPSTACK_API_URL o CHIRPSTACK_API_KEY', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            DevicesService,
            { provide: DeviceRepository, useValue: {} },
            { provide: DeviceProfileRepository, useValue: {} },
            { provide: HttpService, useValue: { axiosRef: {}, get: jest.fn() } },
            {
              provide: ConfigService,
              useValue: { get: jest.fn(() => undefined) },
            },
          ],
        }).compile(),
      ).rejects.toThrow(/CHIRPSTACK_API_URL and CHIRPSTACK_API_KEY/);
    });
  });

  describe('create', () => {
    it('lanza BadRequestException si el perfil no existe', async () => {
      deviceProfileRepository.findOne.mockResolvedValue(null);

      await expect(service.create(baseCreateDto)).rejects.toThrow(
        new BadRequestException(`Device profile with ID ${profileId} not found`),
      );

      expect(deviceProfileRepository.findOne).toHaveBeenCalledWith(profileId, tenantId);
    });

    it('delega en createDevice con valores del perfil cuando el DTO no trae overrides ChirpStack', async () => {
      deviceProfileRepository.findOne.mockResolvedValue(deviceProfile);
      const createSpy = jest.spyOn(service, 'createDevice').mockResolvedValue(device);

      const dto: CreateDeviceDto = { ...baseCreateDto };
      delete dto.csJoineui;
      delete dto.csAppKey;
      delete dto.csNwkKey;

      const result = await service.create(dto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          csJoineui: deviceProfile.csJoineui,
          csApplicationId: deviceProfile.csApplicationId,
          csAppKey: deviceProfile.csAppKey,
          csNwkKey: deviceProfile.csNwkKey,
        }),
        deviceProfile,
        expect.objectContaining({
          devEui: dto.deveui,
          joinEui: deviceProfile.csJoineui,
          applicationId: deviceProfile.csApplicationId,
        }),
        { appKey: deviceProfile.csAppKey, nwkKey: deviceProfile.csNwkKey },
      );
      expect(result).toBe(device);
    });

    it('usa overrides del DTO para joinEui, applicationId y keys', async () => {
      deviceProfileRepository.findOne.mockResolvedValue(deviceProfile);
      const createSpy = jest.spyOn(service, 'createDevice').mockResolvedValue(device);

      const dto: CreateDeviceDto = {
        ...baseCreateDto,
        csJoineui: 'aaaaaaaaaaaaaaaa',
        csApplicationId: '66666666-6666-6666-6666-666666666666',
        csAppKey: '11111111111111111111111111111111',
        csNwkKey: '22222222222222222222222222222222',
      };

      await service.create(dto);

      expect(createSpy).toHaveBeenCalledWith(
        dto,
        deviceProfile,
        expect.objectContaining({
          joinEui: dto.csJoineui,
          applicationId: dto.csApplicationId,
        }),
        { appKey: dto.csAppKey, nwkKey: dto.csNwkKey },
      );
    });
  });

  describe('createDevice', () => {
    it('lanza ConflictException si el DevEUI ya existe en el tenant', async () => {
      deviceRepository.findByDevEuiAndTenantId.mockResolvedValue(device);

      await expect(
        service.createDevice(baseCreateDto, deviceProfile, chirpstackDevice, deviceKeys),
      ).rejects.toThrow(
        new ConflictException(`Device with DevEUI ${baseCreateDto.deveui} already exists`),
      );

      expect(httpPost).not.toHaveBeenCalled();
      expect(deviceRepository.create).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si createDeviceInChirpstack devuelve false', async () => {
      deviceRepository.findByDevEuiAndTenantId.mockResolvedValue(null);
      jest.spyOn(service, 'createDeviceInChirpstack').mockResolvedValue(false);

      await expect(
        service.createDevice(baseCreateDto, deviceProfile, chirpstackDevice, deviceKeys),
      ).rejects.toThrow(new BadRequestException('Error creating device in Chirpstack'));

      expect(deviceRepository.create).not.toHaveBeenCalled();
    });

    it('persiste en BD cuando ChirpStack responde correctamente', async () => {
      deviceRepository.findByDevEuiAndTenantId.mockResolvedValue(null);
      jest.spyOn(service, 'createDeviceInChirpstack').mockResolvedValue(true);
      deviceRepository.create.mockResolvedValue(device);

      const result = await service.createDevice(
        baseCreateDto,
        deviceProfile,
        chirpstackDevice,
        deviceKeys,
      );

      expect(deviceRepository.create).toHaveBeenCalledWith(baseCreateDto);
      expect(result).toBe(device);
    });

    it('trata findByDevEuiAndTenantId rechazado como dispositivo inexistente', async () => {
      deviceRepository.findByDevEuiAndTenantId.mockRejectedValue(new Error('DB down'));
      jest.spyOn(service, 'createDeviceInChirpstack').mockResolvedValue(true);
      deviceRepository.create.mockResolvedValue(device);

      await service.createDevice(baseCreateDto, deviceProfile, chirpstackDevice, deviceKeys);

      expect(deviceRepository.create).toHaveBeenCalled();
    });
  });

  describe('getDeviceFromChirpstack', () => {
    it('devuelve true cuando ChirpStack responde HTTP 200', async () => {
      httpGet.mockResolvedValue({ status: 200, data: { device: {} } });

      await expect(service.getDeviceFromChirpstack(device.deveui)).resolves.toBe(true);

      expect(httpGet).toHaveBeenCalledWith(
        `https://chirpstack.test/api/devices/${device.deveui}`,
        { headers: chirpstackHeaders },
      );
    });

    it('devuelve false cuando el status no es 200', async () => {
      httpGet.mockResolvedValue({ status: 204, data: {} });

      await expect(service.getDeviceFromChirpstack(device.deveui)).resolves.toBe(false);
    });

    it('devuelve false ante HTTP 401 sin lanzar excepción', async () => {
      httpGet.mockRejectedValue({ response: { status: 401, data: { message: 'unauthorized' } } });

      await expect(service.getDeviceFromChirpstack(device.deveui)).resolves.toBe(false);
    });

    it('lanza BadRequestException ante otros errores HTTP', async () => {
      httpGet.mockRejectedValue({
        response: { status: 500, data: { message: 'server error' } },
        message: 'Request failed',
      });

      await expect(service.getDeviceFromChirpstack(device.deveui)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createDeviceInChirpstack', () => {
    beforeEach(() => {
      httpPost.mockResolvedValue({ status: 200 });
    });

    it('crea dispositivo y keys en ChirpStack cuando no existe', async () => {
      jest.spyOn(service, 'getDeviceFromChirpstack').mockResolvedValue(false);

      const result = await service.createDeviceInChirpstack(chirpstackDevice, deviceKeys);

      expect(result).toBe(true);
      expect(httpPost).toHaveBeenNthCalledWith(
        1,
        'https://chirpstack.test/api/devices',
        { device: chirpstackDevice },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Grpc-Metadata-Authorization': 'Bearer test-token',
          }),
        }),
      );
      expect(httpPost).toHaveBeenNthCalledWith(
        2,
        `https://chirpstack.test/api/devices/${chirpstackDevice.devEui}/keys`,
        { deviceKeys },
        expect.any(Object),
      );
    });

    it('actualiza dispositivo existente vía callUpdateDeviceInChirpstack', async () => {
      jest.spyOn(service, 'getDeviceFromChirpstack').mockResolvedValue(true);
      const updateSpy = jest
        .spyOn(service, 'callUpdateDeviceInChirpstack')
        .mockResolvedValue(true);

      const result = await service.createDeviceInChirpstack(chirpstackDevice, deviceKeys);

      expect(result).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        chirpstackDevice.devEui,
        chirpstackDevice,
        deviceKeys,
      );
      expect(httpPost).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si la petición falla', async () => {
      jest.spyOn(service, 'getDeviceFromChirpstack').mockResolvedValue(false);
      httpPost.mockRejectedValue({
        response: { data: { code: 13, message: 'invalid devEUI' } },
        message: 'Bad Request',
      });

      await expect(
        service.createDeviceInChirpstack(chirpstackDevice, deviceKeys),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateWithDevice', () => {
    const updateDto: UpdateDeviceDto = {
      name: 'Sensor actualizado',
      tags: { cattle: 'cattle-1' },
    };

    it('actualiza ChirpStack y persiste en BD', async () => {
      const updated = { ...device, name: updateDto.name };
      jest.spyOn(service, 'updateDeviceInChirpstack').mockResolvedValue(true);
      deviceRepository.update.mockResolvedValue(updated);

      const result = await service.updateWithDevice(device, updateDto);

      expect(service.updateDeviceInChirpstack).toHaveBeenCalledWith(
        device.deveui,
        updateDto,
        device,
      );
      expect(deviceRepository.update).toHaveBeenCalledWith(device.id, updateDto, undefined);
      expect(result).toBe(updated);
    });

    it('pasa EntityManager al repository cuando se provee', async () => {
      const manager = {} as import('typeorm').EntityManager;
      jest.spyOn(service, 'updateDeviceInChirpstack').mockResolvedValue(true);
      deviceRepository.update.mockResolvedValue(device);

      await service.updateWithDevice(device, updateDto, manager);

      expect(deviceRepository.update).toHaveBeenCalledWith(device.id, updateDto, manager);
    });

    it('lanza BadRequestException si updateDeviceInChirpstack devuelve false', async () => {
      jest.spyOn(service, 'updateDeviceInChirpstack').mockResolvedValue(false);

      await expect(service.updateWithDevice(device, updateDto)).rejects.toThrow(
        /Error updating device in Chirpstack/,
      );

      expect(deviceRepository.update).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si el repository no actualiza', async () => {
      jest.spyOn(service, 'updateDeviceInChirpstack').mockResolvedValue(true);
      deviceRepository.update.mockResolvedValue(null);

      await expect(service.updateWithDevice(device, updateDto)).rejects.toThrow(
        new RegExp(`Error updating device ${device.deveui}`),
      );
    });

    it('envuelve errores de ChirpStack en BadRequestException', async () => {
      jest.spyOn(service, 'updateDeviceInChirpstack').mockRejectedValue({
        message: 'network error',
        response: { data: { detail: 'timeout' } },
      });

      await expect(service.updateWithDevice(device, updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateDeviceInChirpstack', () => {
    it('arma payload con overrides del DTO y delega en callUpdateDeviceInChirpstack', async () => {
      const updateDto: UpdateDeviceDto = {
        csApplicationId: '77777777-7777-7777-7777-777777777777',
        description: 'nueva desc',
        name: 'nuevo nombre',
        tags: { reception: 'r-1' },
        csAppKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      };
      const callSpy = jest.spyOn(service, 'callUpdateDeviceInChirpstack').mockResolvedValue(true);

      const result = await service.updateDeviceInChirpstack(device.deveui, updateDto, device);

      expect(result).toBe(true);
      expect(callSpy).toHaveBeenCalledWith(
        device.deveui,
        expect.objectContaining({
          applicationId: updateDto.csApplicationId,
          description: updateDto.description,
          name: updateDto.name,
          tags: updateDto.tags,
          deviceProfileId: device.idChirpstackProfile,
        }),
        { appKey: updateDto.csAppKey },
      );
    });

    it('usa valores del dispositivo local cuando el DTO no los incluye', async () => {
      const updateDto: UpdateDeviceDto = { tags: { event: 'simple' } };
      const callSpy = jest.spyOn(service, 'callUpdateDeviceInChirpstack').mockResolvedValue(true);

      await service.updateDeviceInChirpstack(device.deveui, updateDto, device);

      expect(callSpy).toHaveBeenCalledWith(
        device.deveui,
        expect.objectContaining({
          applicationId: device.csApplicationId,
          name: device.name,
          deviceProfileId: device.idChirpstackProfile,
          tags: updateDto.tags,
        }),
        {},
      );
    });
  });

  describe('callUpdateDeviceInChirpstack', () => {
    const deviceUpdate = { name: 'actualizado', applicationId };
    const emptyKeys = {};

    it('hace PUT del dispositivo y retorna true sin keys', async () => {
      httpPut.mockResolvedValue({ status: 200 });

      await expect(
        service.callUpdateDeviceInChirpstack(device.deveui, deviceUpdate, emptyKeys),
      ).resolves.toBe(true);

      expect(httpPut).toHaveBeenCalledWith(
        `https://chirpstack.test/api/devices/${device.deveui}`,
        { device: deviceUpdate },
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
            'Grpc-Metadata-Authorization': 'Bearer test-token',
          }),
        }),
      );
      expect(httpPost).not.toHaveBeenCalled();
    });

    it('envía keys con POST cuando el PUT del dispositivo es exitoso', async () => {
      httpPut.mockResolvedValue({ status: 200 });
      httpPost.mockResolvedValue({ status: 200 });
      const keys = {
        appKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        nwkKey: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      };

      await expect(
        service.callUpdateDeviceInChirpstack(device.deveui, deviceUpdate, keys),
      ).resolves.toBe(true);

      expect(httpPost).toHaveBeenCalledWith(
        `https://chirpstack.test/api/devices/${device.deveui}/keys`,
        { deviceKeys: keys },
        expect.any(Object),
      );
    });

    it('hace PUT de keys si POST de keys falla', async () => {
      httpPut
        .mockResolvedValueOnce({ status: 200 })
        .mockResolvedValueOnce({ status: 200 });
      httpPost.mockRejectedValue({
        response: { data: { message: 'keys exist' } },
      });
      const keys = { appKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };

      await expect(
        service.callUpdateDeviceInChirpstack(device.deveui, deviceUpdate, keys),
      ).resolves.toBe(true);

      expect(httpPut).toHaveBeenCalledTimes(2);
      expect(httpPut).toHaveBeenLastCalledWith(
        `https://chirpstack.test/api/devices/${device.deveui}/keys`,
        { deviceKeys: keys },
        expect.any(Object),
      );
    });

    it('devuelve false si el PUT del dispositivo no es 200', async () => {
      httpPut.mockResolvedValue({ status: 500 });

      await expect(
        service.callUpdateDeviceInChirpstack(device.deveui, deviceUpdate, emptyKeys),
      ).resolves.toBe(false);
    });

    it('lanza BadRequestException si el PUT del dispositivo falla', async () => {
      httpPut.mockRejectedValue({
        message: 'ECONNREFUSED',
        response: { data: { detail: 'offline' } },
      });

      await expect(
        service.callUpdateDeviceInChirpstack(device.deveui, deviceUpdate, emptyKeys),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('calls ChirpStack DELETE then removes local row when HTTP 200', async () => {
      deviceRepository.findByIdAndTenantId.mockResolvedValue(device);
      httpDelete.mockResolvedValue({ status: 200 });

      await service.remove(deviceId, tenantId);

      expect(deviceRepository.findByIdAndTenantId).toHaveBeenCalledWith(deviceId, tenantId);
      expect(httpDelete).toHaveBeenCalledWith(
        `https://chirpstack.test/api/devices/${device.deveui}`,
        expect.objectContaining({ headers: chirpstackHeaders }),
      );
      expect(deviceRepository.remove).toHaveBeenCalledWith(deviceId);
    });

    it('usa el deveui del dispositivo hallado para borrar en ChirpStack, no el id local', async () => {
      deviceRepository.findByIdAndTenantId.mockResolvedValue(device);
      httpDelete.mockResolvedValue({ status: 200 });

      await service.remove(deviceId, tenantId);

      expect(httpDelete).toHaveBeenCalledWith(
        `https://chirpstack.test/api/devices/${device.deveui}`,
        expect.any(Object),
      );
    });

    it('lanza NotFoundException y no llama a ChirpStack si el repository devuelve null', async () => {
      deviceRepository.findByIdAndTenantId.mockResolvedValue(null);

      await expect(service.remove(deviceId, tenantId)).rejects.toThrow(NotFoundException);

      expect(httpDelete).not.toHaveBeenCalled();
      expect(deviceRepository.remove).not.toHaveBeenCalled();
    });

    it('no llama a ChirpStack ni a remove local si el dispositivo no existe (NotFoundException)', async () => {
      deviceRepository.findByIdAndTenantId.mockRejectedValue(
        new NotFoundException(`Device with ID ${deviceId} not found`),
      );

      await expect(service.remove(deviceId, tenantId)).rejects.toThrow(NotFoundException);

      expect(httpDelete).not.toHaveBeenCalled();
      expect(deviceRepository.remove).not.toHaveBeenCalled();
    });

    it('propaga error si falla el remove local tras DELETE 200 en ChirpStack', async () => {
      deviceRepository.findByIdAndTenantId.mockResolvedValue(device);
      httpDelete.mockResolvedValue({ status: 200 });
      deviceRepository.remove.mockRejectedValue(new Error('DB error'));

      await expect(service.remove(deviceId, tenantId)).rejects.toThrow('DB error');

      expect(httpDelete).toHaveBeenCalled();
      expect(deviceRepository.remove).toHaveBeenCalledWith(deviceId);
    });

    it('does not remove locally if ChirpStack returns non-200', async () => {
      deviceRepository.findByIdAndTenantId.mockResolvedValue(device);
      httpDelete.mockResolvedValue({ status: 502 });

      await expect(service.remove(deviceId, tenantId)).rejects.toThrow(BadRequestException);
      expect(deviceRepository.remove).not.toHaveBeenCalled();
    });

    it('does not remove locally if ChirpStack request throws', async () => {
      deviceRepository.findByIdAndTenantId.mockResolvedValue(device);
      httpDelete.mockRejectedValue({ response: { status: 404, data: { message: 'not found' } } });

      await expect(service.remove(deviceId, tenantId)).rejects.toThrow(BadRequestException);
      expect(deviceRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('existChirpstackApplicationId', () => {
    it('devuelve response.data cuando la aplicación existe', async () => {
      const appPayload = { application: { id: applicationId, name: 'Finca' } };
      httpServiceGet.mockReturnValue(of({ data: appPayload }));

      await expect(service.existChirpstackApplicationId(applicationId)).resolves.toEqual(
        appPayload,
      );

      expect(httpServiceGet).toHaveBeenCalledWith(
        `https://chirpstack.test/api/applications/${applicationId}`,
        { headers: chirpstackHeaders },
      );
    });

    it('lanza BadRequestException ante HTTP 404', async () => {
      httpServiceGet.mockReturnValue(
        throwError(() => ({
          message: 'Not Found',
          response: { status: 404, data: { message: 'not found' } },
        })),
      );

      await expect(service.existChirpstackApplicationId(applicationId)).rejects.toThrow(
        new RegExp(`Application with ID ${applicationId} not found in Chirpstack`),
      );
    });

    it('lanza BadRequestException ante HTTP 401', async () => {
      httpServiceGet.mockReturnValue(
        throwError(() => ({
          message: 'Unauthorized',
          response: { status: 401, data: { message: 'invalid token' } },
        })),
      );

      await expect(service.existChirpstackApplicationId(applicationId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza BadRequestException ante otros errores', async () => {
      httpServiceGet.mockReturnValue(
        throwError(() => ({
          message: 'Gateway Timeout',
          response: { status: 504, data: { message: 'timeout' } },
        })),
      );

      await expect(service.existChirpstackApplicationId(applicationId)).rejects.toThrow(
        /Error validating application with Chirpstack/,
      );
    });
  });
});
