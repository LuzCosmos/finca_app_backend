import { ConfigService } from '@nestjs/config';
import { MqttService } from './mqtt.service';
import { Lw001BgProUplinkParserService } from '../production-center/lw001-bg-pro/lw001-bg-pro-uplink-parser.service';
import { LocationService } from '../farm/services/location.service';
import { DeviceRemoteConfigurationService } from '../production-center/services/device-remote-configuration.service';

describe('MqttService — verificación de configuración remota', () => {
  let service: MqttService;
  let parser: Lw001BgProUplinkParserService;
  let remoteConfig: jest.Mocked<Pick<DeviceRemoteConfigurationService, 'processUplinkForVerification'>>;
  let locationService: jest.Mocked<Pick<LocationService, 'create'>>;

  beforeEach(() => {
    parser = new Lw001BgProUplinkParserService();
    remoteConfig = {
      processUplinkForVerification: jest.fn().mockResolvedValue({ applied: 1, commandsUpdated: ['x'] }),
    };
    locationService = { create: jest.fn().mockResolvedValue(undefined) };

    const config = {
      get: jest.fn().mockReturnValue('localhost'),
    } as unknown as ConfigService;

    service = new MqttService(
      config,
      locationService as unknown as LocationService,
      parser,
      remoteConfig as unknown as DeviceRemoteConfigurationService,
    );
  });

  it('dispara verificación cuando un heartbeat trae respuesta a Read parameters', async () => {
    // Heartbeat (port 1) con header `05 1C 85` + Length=2, ID=06 (workingMode), Value=02 → JSON ChirpStack
    const payloadHex = '051C85020602';
    const data = Buffer.from(payloadHex, 'hex').toString('base64');
    const message: Record<string, unknown> = {
      data,
      fPort: 1,
      deviceInfo: { tags: { idDevice: 'dev-uuid-1' } },
    };

    await (service as unknown as {
      processMokoUplinkForVerification: (m: Record<string, unknown>) => Promise<void>;
    }).processMokoUplinkForVerification(message);

    expect(remoteConfig.processUplinkForVerification).toHaveBeenCalledTimes(1);
    const call = remoteConfig.processUplinkForVerification.mock.calls[0][0];
    expect(call.idDevice).toBe('dev-uuid-1');
    expect(call.parameters).toEqual([
      expect.objectContaining({ id: 0x06, name: 'workingMode', valueHex: '02' }),
    ]);
  });

  it('NO dispara verificación si el heartbeat normal no encaja como Read response', async () => {
    // Heartbeat normal: header + reason(01)+fw(43)+activeStateCount(00 00 00 0A) → 9 bytes.
    // El parser intenta tryParseReadResponse pero un Length=0x00 lo invalida → parameters = undefined.
    const payloadHex = '051C8501430000000A';
    const data = Buffer.from(payloadHex, 'hex').toString('base64');
    await (service as unknown as {
      processMokoUplinkForVerification: (m: Record<string, unknown>) => Promise<void>;
    }).processMokoUplinkForVerification({
      data,
      fPort: 1,
      deviceInfo: { tags: { idDevice: 'dev-uuid-1' } },
    });
    expect(remoteConfig.processUplinkForVerification).not.toHaveBeenCalled();
  });

  it('ignora si no hay tags.idDevice', async () => {
    await (service as unknown as {
      processMokoUplinkForVerification: (m: Record<string, unknown>) => Promise<void>;
    }).processMokoUplinkForVerification({
      data: 'AAEC',
      fPort: 1,
      deviceInfo: { tags: {} },
    });
    expect(remoteConfig.processUplinkForVerification).not.toHaveBeenCalled();
  });

  it('ignora si fPort no es número', async () => {
    await (service as unknown as {
      processMokoUplinkForVerification: (m: Record<string, unknown>) => Promise<void>;
    }).processMokoUplinkForVerification({
      data: 'AAEC',
      fPort: 'not-a-number',
      deviceInfo: { tags: { idDevice: 'dev-1' } },
    });
    expect(remoteConfig.processUplinkForVerification).not.toHaveBeenCalled();
  });

  it('ignora puertos sin TLV (e.g. location_failure)', async () => {
    // location_failure (port 3): header + reasonCode + len + data
    const payloadHex = '051C850A05FF323028 1A'.replace(/\s/g, '');
    const data = Buffer.from(payloadHex, 'hex').toString('base64');
    await (service as unknown as {
      processMokoUplinkForVerification: (m: Record<string, unknown>) => Promise<void>;
    }).processMokoUplinkForVerification({
      data,
      fPort: 3,
      deviceInfo: { tags: { idDevice: 'dev-uuid-1' } },
    });
    expect(remoteConfig.processUplinkForVerification).not.toHaveBeenCalled();
  });

  it('dispara verificación cuando llega una respuesta Read en fPort 10 (Bloque 1 real)', async () => {
    // HEX real capturado del collar: respuesta al CMD Read parameters del Bloque 1 (General).
    // 9 parámetros TLV (IDs 0x04..0x0d) tras el common header.
    const payloadHex = '011de60204fb02060202070005080000012c020901020a01020b00020c03030dffff';
    const data = Buffer.from(payloadHex, 'hex').toString('base64');
    await (service as unknown as {
      processMokoUplinkForVerification: (m: Record<string, unknown>) => Promise<void>;
    }).processMokoUplinkForVerification({
      data,
      fPort: 10,
      deviceInfo: { tags: { idDevice: 'dev-uuid-1' } },
    });
    expect(remoteConfig.processUplinkForVerification).toHaveBeenCalledTimes(1);
    const call = remoteConfig.processUplinkForVerification.mock.calls[0][0];
    expect(call.idDevice).toBe('dev-uuid-1');
    expect(call.parameters.map((p) => p.id)).toEqual([
      0x04, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
    ]);
    // timeZone (0x04) viene como 0xFB → -5 (signed)
    expect(call.parameters[0]).toMatchObject({ id: 0x04, name: 'timeZone', valueHex: 'FB' });
    // heartbeatInterval (0x08) → 4 bytes BE = 300s
    expect(call.parameters[3]).toMatchObject({ id: 0x08, valueHex: '00 00 01 2C' });
  });

  it('dispara verificación con la respuesta Read del Bloque 10 (login password ASCII)', async () => {
    // HEX real: header + (length=9, id=0x05, value="Moko4321")
    const payloadHex = '011be709054d6f6b6f34333231';
    const data = Buffer.from(payloadHex, 'hex').toString('base64');
    await (service as unknown as {
      processMokoUplinkForVerification: (m: Record<string, unknown>) => Promise<void>;
    }).processMokoUplinkForVerification({
      data,
      fPort: 10,
      deviceInfo: { tags: { idDevice: 'dev-uuid-2' } },
    });
    expect(remoteConfig.processUplinkForVerification).toHaveBeenCalledTimes(1);
    const call = remoteConfig.processUplinkForVerification.mock.calls[0][0];
    expect(call.idDevice).toBe('dev-uuid-2');
    expect(call.parameters).toHaveLength(1);
    expect(call.parameters[0]).toMatchObject({
      id: 0x05,
      name: 'loginPassword',
      valueHex: '4D 6F 6B 6F 34 33 32 31',
    });
  });

  it('NO dispara verificación si fPort 10 trae header pero no TLV válido', async () => {
    // Header ok pero los siguientes bytes no encajan como Length+ID+Value.
    const payloadHex = '011de60000';
    const data = Buffer.from(payloadHex, 'hex').toString('base64');
    await (service as unknown as {
      processMokoUplinkForVerification: (m: Record<string, unknown>) => Promise<void>;
    }).processMokoUplinkForVerification({
      data,
      fPort: 10,
      deviceInfo: { tags: { idDevice: 'dev-uuid-3' } },
    });
    expect(remoteConfig.processUplinkForVerification).not.toHaveBeenCalled();
  });

  it('processMqttMessage: sin ubicación en rxInfo aún dispara verificación MOKO (regresión)', async () => {
    const payloadHex = '051C85020602';
    const data = Buffer.from(payloadHex, 'hex').toString('base64');
    const chirpstackJson = {
      data,
      fPort: 1,
      deviceInfo: { tags: { idDevice: 'dev-uuid-1' } },
      rxInfo: [{}],
    };
    const buf = Buffer.from(JSON.stringify(chirpstackJson), 'utf8');
    await (
      service as unknown as {
        processMqttMessage: (t: string, b: Buffer) => Promise<void>;
      }
    ).processMqttMessage('application/1/device/evt/up', buf);

    expect(locationService.create).not.toHaveBeenCalled();
    expect(remoteConfig.processUplinkForVerification).toHaveBeenCalledTimes(1);
  });

  it('processMqttMessage: sin rxInfo aún dispara verificación MOKO', async () => {
    const payloadHex = '051C85020602';
    const data = Buffer.from(payloadHex, 'hex').toString('base64');
    const chirpstackJson = {
      data,
      fPort: 1,
      deviceInfo: { tags: { idDevice: 'dev-uuid-2' } },
    };
    const buf = Buffer.from(JSON.stringify(chirpstackJson), 'utf8');
    await (
      service as unknown as {
        processMqttMessage: (t: string, b: Buffer) => Promise<void>;
      }
    ).processMqttMessage('application/1/device/evt/up', buf);

    expect(locationService.create).not.toHaveBeenCalled();
    expect(remoteConfig.processUplinkForVerification).toHaveBeenCalledTimes(1);
    expect(remoteConfig.processUplinkForVerification.mock.calls[0][0].idDevice).toBe('dev-uuid-2');
  });
});
