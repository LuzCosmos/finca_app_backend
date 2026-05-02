import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DeviceRepository } from '../repositories/device.repository';
import { DeviceProfileRepository } from '../repositories/device-profile.repository';
import { Device } from '../entities/device.entity';

describe('DevicesService', () => {
  let service: DevicesService;
  let deviceRepository: {
    findByIdAndTenantId: jest.Mock;
    remove: jest.Mock;
  };
  let httpDelete: jest.Mock;

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const deviceId = '22222222-2222-2222-2222-222222222222';
  const device = {
    id: deviceId,
    deveui: '0102030405060708',
    idTenant: tenantId,
  } as Device;

  beforeEach(async () => {
    deviceRepository = {
      findByIdAndTenantId: jest.fn(),
      remove: jest.fn(),
    };
    httpDelete = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: DeviceRepository, useValue: deviceRepository },
        { provide: DeviceProfileRepository, useValue: {} },
        {
          provide: HttpService,
          useValue: { axiosRef: { delete: httpDelete } },
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
  });

  describe('remove', () => {
    it('calls ChirpStack DELETE then removes local row when HTTP 200', async () => {
      deviceRepository.findByIdAndTenantId.mockResolvedValue(device);
      httpDelete.mockResolvedValue({ status: 200 });

      await service.remove(deviceId, tenantId);

      expect(deviceRepository.findByIdAndTenantId).toHaveBeenCalledWith(deviceId, tenantId);
      expect(httpDelete).toHaveBeenCalledWith(
        `https://chirpstack.test/api/devices/${device.deveui}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            accept: 'application/json',
            'Grpc-Metadata-Authorization': 'Bearer test-token',
          }),
        }),
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

    it('propaga error si fail el remove local tras DELETE 200 en ChirpStack', async () => {
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
});
