import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ChirpStackDownlinkService } from './chirpstack-downlink.service';

describe('ChirpStackDownlinkService', () => {
  const fakeAxios = {
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  };

  const httpService = {
    axiosRef: fakeAxios,
  } as unknown as HttpService;

  const configMap: Record<string, string> = {
    CHIRPSTACK_API_URL: 'https://chirpstack.example.com/',
    CHIRPSTACK_API_KEY: 'test-token',
  };
  const configService = {
    get: <T>(key: string): T => configMap[key] as unknown as T,
  } as unknown as ConfigService;

  let service: ChirpStackDownlinkService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChirpStackDownlinkService(httpService, configService);
  });

  describe('constructor', () => {
    it('lanza si faltan envs', () => {
      const emptyConfig = { get: () => undefined } as unknown as ConfigService;
      expect(() => new ChirpStackDownlinkService(httpService, emptyConfig)).toThrow(
        /CHIRPSTACK_API_URL and CHIRPSTACK_API_KEY/,
      );
    });
  });

  describe('toBase64', () => {
    it('convierte hex con espacios correctamente', () => {
      // 0x0A 0x01 0x06 = "CgEG" en base64
      expect(service.toBase64('0A 01 06')).toBe('CgEG');
    });

    it('rechaza hex inválido', () => {
      expect(() => service.toBase64('XY ZZ')).toThrow(BadRequestException);
    });

    it('rechaza hex de longitud impar', () => {
      expect(() => service.toBase64('A')).toThrow(BadRequestException);
    });
  });

  describe('enqueue', () => {
    const validDeveui = '0102030405060708';

    it('rechaza DevEUI inválido', async () => {
      await expect(
        service.enqueue('SHORT', { fPort: 10, payloadHex: '0A 01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza fPort fuera de rango', async () => {
      await expect(
        service.enqueue(validDeveui, { fPort: 0, payloadHex: '0A 01' }),
      ).rejects.toThrow(/fPort/);
      await expect(
        service.enqueue(validDeveui, { fPort: 224, payloadHex: '0A 01' }),
      ).rejects.toThrow(/fPort/);
    });

    it('rechaza si no hay payload', async () => {
      await expect(service.enqueue(validDeveui, { fPort: 10 })).rejects.toThrow(
        /payloadHex or payloadBase64/,
      );
    });

    it('encola con HEX y devuelve el queueItemId', async () => {
      fakeAxios.post.mockResolvedValueOnce({ status: 200, data: { id: 'queue-uuid-1' } });

      const result = await service.enqueue(validDeveui, {
        fPort: 10,
        payloadHex: '0A 01 06',
        confirmed: true,
      });

      expect(result).toEqual({ queueItemId: 'queue-uuid-1' });
      expect(fakeAxios.post).toHaveBeenCalledTimes(1);
      const [url, body, opts] = fakeAxios.post.mock.calls[0];
      expect(url).toBe(
        'https://chirpstack.example.com/api/devices/0102030405060708/queue',
      );
      expect(body).toEqual({
        queueItem: { fPort: 10, data: 'CgEG', confirmed: true },
      });
      expect(opts.headers['Grpc-Metadata-Authorization']).toBe('Bearer test-token');
      expect(opts.headers['Content-Type']).toBe('application/json');
    });

    it('acepta payloadBase64 directamente sin volver a codificar', async () => {
      fakeAxios.post.mockResolvedValueOnce({ status: 200, data: { id: 'q1' } });

      await service.enqueue(validDeveui, { fPort: 11, payloadBase64: 'AAEC' });

      const [, body] = fakeAxios.post.mock.calls[0];
      expect(body.queueItem.data).toBe('AAEC');
      expect(body.queueItem.fPort).toBe(11);
      expect(body.queueItem.confirmed).toBe(false);
    });

    it('lanza BadGatewayException si la respuesta no trae id', async () => {
      fakeAxios.post.mockResolvedValueOnce({ status: 200, data: {} });
      await expect(
        service.enqueue(validDeveui, { fPort: 10, payloadHex: '0A 01 06' }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('mapea HTTP 404 a NotFoundException', async () => {
      fakeAxios.post.mockRejectedValueOnce({
        response: { status: 404, data: { code: 5, message: 'object does not exist' } },
      });
      await expect(
        service.enqueue(validDeveui, { fPort: 10, payloadHex: '0A 01 06' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('mapea HTTP 401 a BadGatewayException', async () => {
      fakeAxios.post.mockRejectedValueOnce({
        response: { status: 401, data: { message: 'unauthenticated' } },
      });
      await expect(
        service.enqueue(validDeveui, { fPort: 10, payloadHex: '0A 01 06' }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('mapea HTTP 5xx a BadGatewayException', async () => {
      fakeAxios.post.mockRejectedValueOnce({
        response: { status: 502, data: { message: 'upstream' } },
      });
      await expect(
        service.enqueue(validDeveui, { fPort: 10, payloadHex: '0A 01 06' }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('mapea otros HTTP a BadRequestException', async () => {
      fakeAxios.post.mockRejectedValueOnce({
        response: { status: 400, data: { message: 'bad input' } },
      });
      await expect(
        service.enqueue(validDeveui, { fPort: 10, payloadHex: '0A 01 06' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('list', () => {
    it('devuelve los items de la cola', async () => {
      const items = [
        { id: 'q1', fPort: 10, data: 'CgEG', confirmed: false },
        { id: 'q2', fPort: 11, data: 'AAH/', confirmed: true },
      ];
      fakeAxios.get.mockResolvedValueOnce({ status: 200, data: { result: items, totalCount: 2 } });

      const result = await service.list('0102030405060708');

      expect(result).toEqual(items);
      expect(fakeAxios.get).toHaveBeenCalledWith(
        'https://chirpstack.example.com/api/devices/0102030405060708/queue',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Grpc-Metadata-Authorization': 'Bearer test-token',
          }),
        }),
      );
    });

    it('devuelve [] cuando ChirpStack no manda result', async () => {
      fakeAxios.get.mockResolvedValueOnce({ status: 200, data: {} });
      await expect(service.list('0102030405060708')).resolves.toEqual([]);
    });
  });

  describe('flush', () => {
    it('elimina toda la cola', async () => {
      fakeAxios.delete.mockResolvedValueOnce({ status: 200, data: {} });
      await service.flush('0102030405060708');
      expect(fakeAxios.delete).toHaveBeenCalledWith(
        'https://chirpstack.example.com/api/devices/0102030405060708/queue',
        expect.any(Object),
      );
    });
  });

  describe('cancel', () => {
    it('cancela un solo item por uuid', async () => {
      fakeAxios.delete.mockResolvedValueOnce({ status: 200, data: {} });
      await service.cancel('0102030405060708', 'queue-uuid-1');
      expect(fakeAxios.delete).toHaveBeenCalledWith(
        'https://chirpstack.example.com/api/devices/0102030405060708/queue/queue-uuid-1',
        expect.any(Object),
      );
    });

    it('mapea 404 a NotFoundException', async () => {
      fakeAxios.delete.mockRejectedValueOnce({
        response: { status: 404, data: { message: 'queue item not found' } },
      });
      await expect(service.cancel('0102030405060708', 'queue-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
