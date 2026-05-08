import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeviceRemoteConfigurationService } from './device-remote-configuration.service';
import { Lw001BgProDownlinkCodecService } from '../lw001-bg-pro/lw001-bg-pro-downlink-codec.service';
import { Lw001BgProUplinkParserService } from '../lw001-bg-pro/lw001-bg-pro-uplink-parser.service';
import { ChirpStackDownlinkService } from './chirpstack-downlink.service';

describe('DeviceRemoteConfigurationService', () => {
  const TENANT = 't-1';
  const DEVICE = {
    id: 'dev-uuid-1',
    deveui: '0102030405060708',
    name: 'Collar #1',
    idTenant: TENANT,
  };

  let codec: Lw001BgProDownlinkCodecService;
  let parser: Lw001BgProUplinkParserService;
  let chirpstack: jest.Mocked<Pick<ChirpStackDownlinkService, 'enqueue' | 'list' | 'flush' | 'cancel'>>;
  let deviceRepo: { findByDevEuiAndTenantId: jest.Mock; findByIdAndTenantId: jest.Mock };
  let profileRepo: { findById: jest.Mock };
  let remoteCfgRepo: {
    upsertDesired: jest.Mock;
    findByDevice: jest.Mock;
    applyConfirmedParameters: jest.Mock;
    setDiagnosticState: jest.Mock;
    findExpiredDiagnosticModes: jest.Mock;
  };
  let downlinkRepo: {
    create: jest.Mock;
    update: jest.Mock;
    findLatestPendingVerificationForDevice: jest.Mock;
  };
  let service: DeviceRemoteConfigurationService;
  let createIdSeq = 1;

  beforeEach(() => {
    codec = new Lw001BgProDownlinkCodecService();
    parser = new Lw001BgProUplinkParserService();
    chirpstack = {
      enqueue: jest.fn(),
      list: jest.fn(),
      flush: jest.fn(),
      cancel: jest.fn(),
    };
    deviceRepo = {
      findByDevEuiAndTenantId: jest.fn().mockResolvedValue(DEVICE),
      findByIdAndTenantId: jest.fn().mockResolvedValue(DEVICE),
    };
    profileRepo = { findById: jest.fn() };
    remoteCfgRepo = {
      upsertDesired: jest
        .fn()
        .mockImplementation(async ({ desired }) => ({ desiredVersion: 1, desired })),
      findByDevice: jest.fn(),
      applyConfirmedParameters: jest.fn(),
      setDiagnosticState: jest.fn().mockResolvedValue(null),
      findExpiredDiagnosticModes: jest.fn().mockResolvedValue([]),
    };
    createIdSeq = 1;
    downlinkRepo = {
      create: jest.fn().mockImplementation(async (input) => ({
        id: `cmd-${createIdSeq++}`,
        ...input,
      })),
      update: jest.fn().mockImplementation(async (id, patch) => ({
        id,
        idTenant: TENANT,
        idDevice: DEVICE.id,
        type: 'CONFIGURE',
        parameters: {},
        ...patch,
      })),
      findLatestPendingVerificationForDevice: jest.fn().mockResolvedValue([]),
    };
    chirpstack.enqueue.mockResolvedValue({ queueItemId: 'q-uuid-1' });

    service = new DeviceRemoteConfigurationService(
      codec,
      parser,
      chirpstack as unknown as ChirpStackDownlinkService,
      deviceRepo as never,
      profileRepo as never,
      remoteCfgRepo as never,
      downlinkRepo as never,
    );
  });

  describe('applyProfile', () => {
    it('aplica el perfil completo, encola CONFIGURE y READ de verificación', async () => {
      profileRepo.findById.mockResolvedValue({
        id: 'p-1',
        idTenant: null,
        code: 'NORMAL_1H',
        name: 'Normal 1h',
        isActive: true,
        parameters: {
          workingMode: 'periodic',
          heartbeatInterval: 720,
          periodicReportInterval: 3600,
          tamperAlarmSwitch: true,
        },
      });

      const result = await service.applyProfile({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
        idProfile: 'p-1',
        idUser: 'u-1',
      });

      expect(result.queueItemId).toBe('q-uuid-1');
      expect(remoteCfgRepo.upsertDesired).toHaveBeenCalledWith(
        expect.objectContaining({
          idTenant: TENANT,
          idDevice: DEVICE.id,
          desired: expect.objectContaining({
            workingMode: 'periodic',
            heartbeatInterval: 720,
            periodicReportInterval: 3600,
            tamperAlarmSwitch: true,
            shockDetectionSwitch: true,
            manDownDetectionSwitch: true,
            shockThreshold: 30,
            shockTimeout: 15,
            shockReportInterval: 255,
            idleDetectionTimeout: 120,
          }),
        }),
      );

      // 2 enqueues: configure + verification read
      expect(chirpstack.enqueue).toHaveBeenCalledTimes(2);
      expect(downlinkRepo.create).toHaveBeenCalledTimes(2);

      const [, configureOpts] = chirpstack.enqueue.mock.calls[0];
      expect(configureOpts.fPort).toBe(10);
      const configureBuffer = Buffer.from(configureOpts.payloadBase64!, 'base64');
      // Debe empezar por 0x02 (CONFIGURE).
      expect(configureBuffer.readUInt8(0)).toBe(0x02);
      // Debe contener el ID de workingMode (0x06).
      expect(configureBuffer.includes(Buffer.of(0x06))).toBe(true);

      const [, readOpts] = chirpstack.enqueue.mock.calls[1];
      expect(readOpts.fPort).toBe(10);
      const readBuffer = Buffer.from(readOpts.payloadBase64!, 'base64');
      expect(readBuffer.readUInt8(0)).toBe(0x01);
      // READ de verificación: IDs del perfil mergeado (incl. shock / man-down / idle).
      const idsAfterCmd = Array.from(readBuffer.subarray(1));
      expect(idsAfterCmd).toEqual(
        expect.arrayContaining([
          0x06, 0x08, 0x21, 0x88, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
        ]),
      );
    });

    it('rechaza perfil con parámetros peligrosos', async () => {
      profileRepo.findById.mockResolvedValue({
        id: 'p-2',
        idTenant: null,
        code: 'BAD',
        name: 'bad',
        isActive: true,
        parameters: { region: 'eu868' },
      });
      await expect(
        service.applyProfile({ deveui: DEVICE.deveui, idTenant: TENANT, idProfile: 'p-2' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza perfil de otro tenant', async () => {
      profileRepo.findById.mockResolvedValue({
        id: 'p-3',
        idTenant: 'OTHER',
        code: 'X',
        name: 'x',
        isActive: true,
        parameters: { workingMode: 'periodic' },
      });
      await expect(
        service.applyProfile({ deveui: DEVICE.deveui, idTenant: TENANT, idProfile: 'p-3' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza perfil sin parámetros', async () => {
      profileRepo.findById.mockResolvedValue({
        id: 'p-4',
        idTenant: null,
        code: 'EMPTY',
        name: 'empty',
        isActive: true,
        parameters: {},
      });
      await expect(
        service.applyProfile({ deveui: DEVICE.deveui, idTenant: TENANT, idProfile: 'p-4' }),
      ).rejects.toThrow(/no parameters/);
    });
  });

  describe('configureParameters', () => {
    it('rechaza claves no soportadas', async () => {
      await expect(
        service.configureParameters({
          deveui: DEVICE.deveui,
          idTenant: TENANT,
          parameters: { unknownKey: 1 } as never,
        }),
      ).rejects.toThrow(/not supported/);
    });

    it('encola configure + read y persiste con desired_version', async () => {
      remoteCfgRepo.upsertDesired.mockResolvedValueOnce({
        desiredVersion: 7,
        desired: { heartbeatInterval: 3600 },
      });

      const result = await service.configureParameters({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
        parameters: { heartbeatInterval: 3600 },
      });

      expect(result.queueItemId).toBe('q-uuid-1');
      expect(downlinkRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CONFIGURE',
          desiredVersion: 7,
          parameters: { heartbeatInterval: 3600 },
        }),
      );
    });
  });

  describe('control commands', () => {
    it('requestPosition encola CONTROL 00 01', async () => {
      const result = await service.requestPosition({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
      });
      expect(result.queueItemId).toBe('q-uuid-1');
      const [, opts] = chirpstack.enqueue.mock.calls[0];
      const buf = Buffer.from(opts.payloadBase64!, 'base64');
      expect(Array.from(buf)).toEqual([0x00, 0x01]);
      expect(downlinkRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CONTROL', action: 'control:downlink_position' }),
      );
    });

    it('rebootDevice encola CONTROL 00 00', async () => {
      await service.rebootDevice({ deveui: DEVICE.deveui, idTenant: TENANT });
      const [, opts] = chirpstack.enqueue.mock.calls[0];
      const buf = Buffer.from(opts.payloadBase64!, 'base64');
      expect(Array.from(buf)).toEqual([0x00, 0x00]);
    });

    it('clearManDown encola CONTROL 00 03', async () => {
      await service.clearManDown({ deveui: DEVICE.deveui, idTenant: TENANT });
      const [, opts] = chirpstack.enqueue.mock.calls[0];
      const buf = Buffer.from(opts.payloadBase64!, 'base64');
      expect(Array.from(buf)).toEqual([0x00, 0x03]);
    });

    it('requestBatteryConsumption encola CONTROL 00 04', async () => {
      await service.requestBatteryConsumption({ deveui: DEVICE.deveui, idTenant: TENANT });
      const [, opts] = chirpstack.enqueue.mock.calls[0];
      const buf = Buffer.from(opts.payloadBase64!, 'base64');
      expect(Array.from(buf)).toEqual([0x00, 0x04]);
    });
  });

  describe('readParameters', () => {
    it('rechaza nombres desconocidos', async () => {
      await expect(
        service.readParameters({
          deveui: DEVICE.deveui,
          idTenant: TENANT,
          parameterNames: ['xyz'],
        }),
      ).rejects.toThrow(/Unknown parameter/);
    });

    it('rechaza dangerous reads sin allowDangerousReads', async () => {
      await expect(
        service.readParameters({
          deveui: DEVICE.deveui,
          idTenant: TENANT,
          parameterNames: ['region'],
        }),
      ).rejects.toThrow(/dangerous/);
    });

    it('permite dangerous reads cuando allowDangerousReads=true', async () => {
      const r = await service.readParameters({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
        parameterNames: ['region'],
        allowDangerousReads: true,
      });
      expect(r.queueItemId).toBe('q-uuid-1');
      const [, opts] = chirpstack.enqueue.mock.calls[0];
      const buf = Buffer.from(opts.payloadBase64!, 'base64');
      expect(Array.from(buf)).toEqual([0x01, 0x60]);
    });

    it('encola READ con los IDs correctos para múltiples nombres', async () => {
      await service.readParameters({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
        parameterNames: ['workingMode', 'heartbeatInterval'],
      });
      const [, opts] = chirpstack.enqueue.mock.calls[0];
      const buf = Buffer.from(opts.payloadBase64!, 'base64');
      expect(Array.from(buf)).toEqual([0x01, 0x06, 0x08]);
    });
  });

  /**
   * HEX exactos esperados por el operador para los 18 bloques predefinidos.
   *
   * Los bloques 2 (Periodic/Timing/Motion), 6 (GPS), 7 (LoRaWAN básico),
   * 8 (Bluetooth broadcast) y 9 (Sensores/alertas) se subdividieron en sub-bloques
   * (sufijos A/B/C) tras observar en producción que el firmware no respondía con TLV
   * para esos payloads grandes (solo emitía event 0x03 `triggered_by_downlink`).
   * Los bloques que **sí** funcionaban (1, 3, 5, 10) y el bloque 4 (que probablemente
   * solo se perdió en cola) se mantienen tal cual. Las keys (11) también se mantienen.
   *
   * Garantizan que la repartición por categorías del PDF MOKO produce los downlinks
   * que se disparan manualmente para diagnosticar el firmware.
   */
  const EXPECTED_BLOCK_HEX = [
    '0104060708090a0b0c0d',         // 0 — General                  (igual)
    '012021222324',                 // 1 — Periodic/Timing 2A        (subdividido)
    '012526272829',                 // 2 — Motion on-start 2B        (subdividido)
    '012a2b2c2d',                   // 3 — Motion on-end 2C          (subdividido)
    '013031323334353c3e45',         // 4 — WiFi/BT básico            (igual, era #3)
    '01363738393a3b',               // 5 — Filtros BLE A             (igual, era #4)
    '013f4041424344',               // 6 — Filtros BLE B             (igual, era #5)
    '0148494a4b4c4d',               // 7 — GPS accuracy 6A           (subdividido)
    '014e4f50515253',               // 8 — GPS aiding 6B             (subdividido)
    '0160616364',                   // 9 — LoRaWAN region/ids 7A     (subdividido)
    '01696a6b6c',                   // 10 — LoRaWAN msg/CH/DR 7B     (subdividido)
    '016d6e6f',                     // 11 — LoRaWAN duty/sync 7C     (subdividido)
    '017071727374',                 // 12 — BLE beacon+UUID 8A       (subdividido)
    '0175767778797a',               // 13 — BLE Major/Minor/Pwr 8B   (subdividido)
    '01808182838485',               // 14 — Axis + shock detalle 9A  (subdividido)
    '01868788898a',                 // 15 — Man down + tamper 9B     (subdividido)
    '0105',                         // 16 — Password BLE             (igual, era #10)
    '0105656768',                   // 17 — Keys (sensible)          (igual, era #11)
  ];

  describe('readAllSafeParameters', () => {
    it('encola un READ por cada bloque predefinido', async () => {
      const r = await service.readAllSafeParameters({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
      });
      expect(r.chunksEnqueued).toBe(EXPECTED_BLOCK_HEX.length);
      expect(r.commands).toHaveLength(EXPECTED_BLOCK_HEX.length);
      expect(chirpstack.enqueue).toHaveBeenCalledTimes(EXPECTED_BLOCK_HEX.length);
      // El primer chunk debe ser exactamente el bloque 1 (General).
      const firstCallPayload = Buffer.from(
        chirpstack.enqueue.mock.calls[0][1].payloadBase64!,
        'base64',
      );
      expect(firstCallPayload.toString('hex')).toBe(EXPECTED_BLOCK_HEX[0]);
    });
  });

  describe('getReadSafeParametersChunkPlan', () => {
    it('devuelve los 18 bloques (incluyendo subdivisiones A/B/C) con su categoría y conteo', async () => {
      const plan = await service.getReadSafeParametersChunkPlan(DEVICE.deveui, TENANT);
      expect(plan.totalChunks).toBe(EXPECTED_BLOCK_HEX.length);
      expect(plan.totalChunks).toBe(18);

      expect(plan.chunks[0].chunkIndex).toBe(0);
      expect(plan.chunks[0].category).toBe('general');
      expect(plan.chunks[0].count).toBe(9);

      expect(plan.chunks[1].category).toBe('periodicTimingMotionA');
      expect(plan.chunks[1].count).toBe(5);
      expect(plan.chunks[3].category).toBe('periodicTimingMotionC');
      expect(plan.chunks[3].count).toBe(4);

      expect(plan.chunks[7].category).toBe('gpsA');
      expect(plan.chunks[8].category).toBe('gpsB');

      expect(plan.chunks[9].category).toBe('lorawanBasicA');
      expect(plan.chunks[11].category).toBe('lorawanBasicC');

      expect(plan.chunks[12].category).toBe('bluetoothBroadcastA');
      expect(plan.chunks[13].category).toBe('bluetoothBroadcastB');

      expect(plan.chunks[14].category).toBe('sensorsAndAlertsA');
      expect(plan.chunks[15].category).toBe('sensorsAndAlertsB');

      expect(plan.chunks[16].category).toBe('bluetoothPassword');
      expect(plan.chunks[17].category).toBe('lorawanKeys');

      expect(chirpstack.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('readSafeParametersChunk', () => {
    it('encola solo el bloque indicado', async () => {
      await service.readSafeParametersChunk({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
        chunkIndex: 0,
      });
      expect(chirpstack.enqueue).toHaveBeenCalledTimes(1);
      const created = downlinkRepo.create.mock.calls[0][0] as { action: string };
      expect(created.action).toBe(
        `readSafeParametersChunk:1/${EXPECTED_BLOCK_HEX.length}`,
      );
    });

    it('chunkIndex fuera de rango lanza BadRequest', async () => {
      await expect(
        service.readSafeParametersChunk({
          deveui: DEVICE.deveui,
          idTenant: TENANT,
          chunkIndex: EXPECTED_BLOCK_HEX.length,
        }),
      ).rejects.toThrow(/chunkIndex must be an integer/);
      expect(chirpstack.enqueue).not.toHaveBeenCalled();
    });

    it.each(EXPECTED_BLOCK_HEX.map((hex, i) => [i, hex]))(
      'chunkIndex=%i produce el HEX exacto %s',
      async (chunkIndex, expectedHex) => {
        await service.readSafeParametersChunk({
          deveui: DEVICE.deveui,
          idTenant: TENANT,
          chunkIndex: chunkIndex as number,
        });
        const [, opts] = chirpstack.enqueue.mock.calls[0];
        const buf = Buffer.from(opts.payloadBase64!, 'base64');
        expect(buf.toString('hex')).toBe(expectedHex);
      },
    );
  });

  describe('setLorawanOnlyPositioning', () => {
    /**
     * El operador pulsa "Solo LoRaWAN" para que el collar deje de intentar fixes
     * locales (GPS / WiFi / BT) y la posición quede a cargo del LNS por TDOA/RSSI.
     *
     * El método encola UN ÚNICO Configure con las 6 position-strategy del PDF MOKO
     * en `0x00` (todos los bits a 0):
     *
     *   0x20 periodicPositioningStrategy
     *   0x22 timingPositioningStrategy
     *   0x26 motionPositionStrategyOnTripStart
     *   0x28 motionPositionStrategyInTrip
     *   0x2c motionPositionStrategyOnTripEnd
     *   0x2d downlinkForPositionStrategy
     *
     * HEX exacto:
     *   02              CMD Configure
     *   02 20 00        periodic            (LL=2, ID=0x20, val=0x00)
     *   02 22 00        timing
     *   02 26 00        motion-on-trip-start
     *   02 28 00        motion-in-trip
     *   02 2C 00        motion-on-trip-end
     *   02 2D 00        downlink-for-position
     */
    const EXPECTED_HEX_LORAWAN_ONLY = '02022000022200022600022800022c00022d00';

    it('encola UN único Configure en port 10 con las 6 strategies en 0', async () => {
      await service.setLorawanOnlyPositioning({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
        idUser: 'user-x',
      });

      expect(chirpstack.enqueue).toHaveBeenCalledTimes(1);
      expect(chirpstack.enqueue).toHaveBeenCalledWith(
        DEVICE.deveui,
        expect.objectContaining({ fPort: 10 }),
      );

      const [, opts] = chirpstack.enqueue.mock.calls[0];
      const buf = Buffer.from(opts.payloadBase64!, 'base64');
      expect(buf.toString('hex').toLowerCase()).toBe(EXPECTED_HEX_LORAWAN_ONLY);
    });

    it('persiste el comando con `action=setLorawanOnlyPositioning` y los 6 parámetros', async () => {
      await service.setLorawanOnlyPositioning({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
        idUser: 'user-x',
      });

      const created = downlinkRepo.create.mock.calls[0][0] as {
        type: string;
        fPort: number;
        action: string;
        parameters: Record<string, unknown>;
        payloadHex: string;
      };
      expect(created.type).toBe('CONFIGURE');
      expect(created.fPort).toBe(10);
      expect(created.action).toBe('setLorawanOnlyPositioning');
      expect(created.payloadHex.toLowerCase()).toBe(EXPECTED_HEX_LORAWAN_ONLY);

      // Los 6 parameters deben ir como `{ wifi:false, bluetooth:false, gps:false }`.
      const allOff = { wifi: false, bluetooth: false, gps: false };
      expect(created.parameters).toEqual({
        periodicPositioningStrategy: allOff,
        timingPositioningStrategy: allOff,
        motionPositionStrategyOnTripStart: allOff,
        motionPositionStrategyInTrip: allOff,
        motionPositionStrategyOnTripEnd: allOff,
        downlinkForPositionStrategy: allOff,
      });
    });
  });

  describe('localStorageCommand', () => {
    it('upload con lastDays=7 → port 11, payload 00 00 07', async () => {
      await service.localStorageCommand({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
        command: { action: 'upload', lastDays: 7 },
      });
      const [, opts] = chirpstack.enqueue.mock.calls[0];
      expect(opts.fPort).toBe(11);
      const buf = Buffer.from(opts.payloadBase64!, 'base64');
      expect(Array.from(buf)).toEqual([0x00, 0x00, 0x07]);
    });

    it('clear → port 11, payload 01', async () => {
      await service.localStorageCommand({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
        command: { action: 'clear' },
      });
      const [, opts] = chirpstack.enqueue.mock.calls[0];
      const buf = Buffer.from(opts.payloadBase64!, 'base64');
      expect(Array.from(buf)).toEqual([0x01]);
    });
  });

  describe('persistAndEnqueue error handling', () => {
    it('marca FAILED si ChirpStack rechaza', async () => {
      chirpstack.enqueue.mockRejectedValueOnce(new Error('chirp 502'));
      await expect(
        service.requestPosition({ deveui: DEVICE.deveui, idTenant: TENANT }),
      ).rejects.toThrow(/chirp 502/);
      expect(downlinkRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: 'FAILED', errorMessage: expect.stringContaining('chirp 502') }),
      );
    });
  });

  describe('processUplinkForVerification (estricto)', () => {
    it('marca como APPLIED comandos cuyos parámetros fueron confirmados', async () => {
      const cmd1 = {
        id: 'cmd-applied',
        type: 'CONFIGURE',
        parameters: { heartbeatInterval: 3600 },
      };
      const cmd2 = {
        id: 'cmd-pending',
        type: 'CONFIGURE',
        parameters: { workingMode: 'periodic', heartbeatInterval: 3600 },
      };
      downlinkRepo.findLatestPendingVerificationForDevice.mockResolvedValue([cmd1, cmd2]);
      remoteCfgRepo.applyConfirmedParameters.mockResolvedValue({
        idDevice: DEVICE.id,
        confirmed: { heartbeatInterval: '00000E10' },
      });

      const r = await service.processUplinkForVerification({
        idDevice: DEVICE.id,
        parameters: [{ id: 0x08, name: 'heartbeatInterval', valueHex: '00 00 0E 10' }],
      });

      expect(remoteCfgRepo.applyConfirmedParameters).toHaveBeenCalledWith(
        DEVICE.id,
        { heartbeatInterval: '00 00 0E 10' },
        expect.any(Number),
      );
      expect(r.commandsUpdated).toEqual(['cmd-applied']);
      expect(downlinkRepo.update).toHaveBeenCalledWith('cmd-applied', expect.objectContaining({
        status: 'APPLIED',
        verifiedAt: expect.any(Date),
      }));
      // cmd-pending tiene workingMode también; no se confirmó, por lo tanto NO se marca.
      expect(downlinkRepo.update).not.toHaveBeenCalledWith('cmd-pending', expect.anything());
    });

    it('no hace nada si el remoteConfig no existe', async () => {
      remoteCfgRepo.applyConfirmedParameters.mockResolvedValue(null);
      const r = await service.processUplinkForVerification({
        idDevice: DEVICE.id,
        parameters: [{ id: 0x08, name: 'heartbeatInterval', valueHex: '00 00 0E 10' }],
      });
      expect(r.commandsUpdated).toEqual([]);
      expect(downlinkRepo.update).not.toHaveBeenCalled();
    });

    it('ignora respuestas sin nombres conocidos', async () => {
      const r = await service.processUplinkForVerification({
        idDevice: DEVICE.id,
        parameters: [{ id: 0xff, valueHex: 'AA' }],
      });
      expect(r.applied).toBe(0);
    });
  });

  describe('diagnosticMode', () => {
    // El codec serializa el payload Configure en HEX continuo (sin separadores).
    // Los HEX esperados de cada test están escritos a mano siguiendo la estructura
    // `CMD + LL+ID+VAL` por bloque para que un cambio accidental en el orden de los
    // 4 parámetros del modo diagnóstico se detecte de inmediato.

    it('enable: persiste snapshot, desired y encola CONFIGURE con los 4 IDs', async () => {
      remoteCfgRepo.findByDevice.mockResolvedValue({
        idDevice: DEVICE.id,
        idTenant: TENANT,
        desired: {
          shockDetectionSwitch: true,
          manDownDetectionSwitch: true,
          tamperAlarmSwitch: true,
          heartbeatInterval: 720,
        },
        confirmed: {},
        diagnosticState: null,
      });

      const result = await service.enableDiagnosticMode({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
        idUser: 'user-x',
      });

      // Persiste el desired pisado con los valores diagnósticos.
      expect(remoteCfgRepo.upsertDesired).toHaveBeenCalledWith(
        expect.objectContaining({
          desired: {
            shockDetectionSwitch: false,
            manDownDetectionSwitch: false,
            tamperAlarmSwitch: false,
            heartbeatInterval: 300,
          },
        }),
      );

      // Persiste el diagnostic_state con previous == valores actuales.
      expect(remoteCfgRepo.setDiagnosticState).toHaveBeenCalledWith(
        DEVICE.id,
        expect.objectContaining({
          active: true,
          enabledByUserId: 'user-x',
          previous: {
            shockDetectionSwitch: true,
            manDownDetectionSwitch: true,
            tamperAlarmSwitch: true,
            heartbeatInterval: 720,
          },
        }),
      );

      // El comando persistido en device_downlink_commands incluye los 4 IDs vía `parameters`.
      const created = downlinkRepo.create.mock.calls[0][0] as {
        type: string;
        fPort: number;
        action: string;
        parameters: Record<string, unknown>;
        payloadHex: string;
      };
      expect(created.type).toBe('CONFIGURE');
      expect(created.fPort).toBe(10);
      expect(created.action).toBe('diagnosticMode:enable');
      expect(created.parameters).toEqual({
        shockDetectionSwitch: false,
        manDownDetectionSwitch: false,
        tamperAlarmSwitch: false,
        heartbeatInterval: 300,
      });
      // HEX EXACTO del payload — al estilo de los casos unitarios de H01.
      // Estructura: 02 (CMD Configure) + bloques `LL ID VAL...` en el orden
      // `shock(0x82)=00 → manDown(0x86)=00 → tamper(0x88)=00 → heartbeat(0x08)=300`.
      //   02              CMD Configure
      //   02 82 00        shockDetectionSwitch=false (LL=2, ID=0x82, val=0x00)
      //   02 86 00        manDownDetectionSwitch=false
      //   02 88 00        tamperAlarmSwitch=false
      //   05 08 00 00 01 2C  heartbeatInterval=300 (LL=5, ID=0x08, val=BE 0x0000012C)
      expect(created.payloadHex).toBe('0202820002860002880005080000012C');

      // Encola un CONFIGURE en port 10 (verificado vía args al adapter ChirpStack).
      expect(chirpstack.enqueue).toHaveBeenCalledTimes(1);
      expect(chirpstack.enqueue).toHaveBeenCalledWith(
        DEVICE.deveui,
        expect.objectContaining({ fPort: 10 }),
      );

      // ttl por default = 30 min.
      expect(result.diagnosticState.ttlMinutes).toBe(60);
      const ageMs =
        Date.parse(result.diagnosticState.expiresAt) -
        Date.parse(result.diagnosticState.enabledAt);
      expect(ageMs).toBe(60 * 60_000);
    });

    it('enable: ttl explícito dentro de rango sobrescribe el default', async () => {
      remoteCfgRepo.findByDevice.mockResolvedValue(null);
      const result = await service.enableDiagnosticMode({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
        idUser: 'u',
        ttlMinutes: 90,
      });
      expect(result.diagnosticState.ttlMinutes).toBe(90);
    });

    it('enable: ttl fuera de rango lanza BadRequest', async () => {
      await expect(
        service.enableDiagnosticMode({
          deveui: DEVICE.deveui,
          idTenant: TENANT,
          ttlMinutes: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(chirpstack.enqueue).not.toHaveBeenCalled();
    });

    it('enable: si ya hay un diagnostic_state activo, conserva el snapshot original', async () => {
      const existing = {
        idDevice: DEVICE.id,
        idTenant: TENANT,
        desired: {
          shockDetectionSwitch: false, // ya está pisado por enable previo
          manDownDetectionSwitch: false,
          tamperAlarmSwitch: false,
          heartbeatInterval: 300,
        },
        confirmed: {},
        diagnosticState: {
          active: true,
          enabledAt: '2026-05-07T20:00:00.000Z',
          expiresAt: '2026-05-07T20:30:00.000Z',
          previous: {
            shockDetectionSwitch: true,
            manDownDetectionSwitch: true,
            tamperAlarmSwitch: true,
            heartbeatInterval: 1440, // valor distinto del fallback
          },
          enabledByUserId: 'old-user',
          ttlMinutes: 30,
        },
      };
      remoteCfgRepo.findByDevice.mockResolvedValue(existing);

      const result = await service.enableDiagnosticMode({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
        idUser: 'new-user',
      });

      // El previous se conserva del estado anterior (no se pisa con `desired` actual).
      expect(result.diagnosticState.previous.heartbeatInterval).toBe(1440);
    });

    it('disable: encola Configure restaurando previous y limpia diagnostic_state', async () => {
      remoteCfgRepo.findByDevice.mockResolvedValue({
        idDevice: DEVICE.id,
        idTenant: TENANT,
        desired: {},
        confirmed: {},
        diagnosticState: {
          active: true,
          enabledAt: '2026-05-07T20:00:00.000Z',
          expiresAt: '2026-05-07T20:30:00.000Z',
          previous: {
            shockDetectionSwitch: true,
            manDownDetectionSwitch: true,
            tamperAlarmSwitch: true,
            heartbeatInterval: 720,
          },
          enabledByUserId: null,
          ttlMinutes: 30,
        },
      });

      const r = await service.disableDiagnosticMode({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
        idUser: 'user-x',
        triggeredBy: 'user',
      });

      expect(remoteCfgRepo.upsertDesired).toHaveBeenCalledWith(
        expect.objectContaining({
          desired: {
            shockDetectionSwitch: true,
            manDownDetectionSwitch: true,
            tamperAlarmSwitch: true,
            heartbeatInterval: 720,
          },
        }),
      );
      expect(remoteCfgRepo.setDiagnosticState).toHaveBeenCalledWith(DEVICE.id, null);
      expect(r.command).not.toBeNull();
      expect(r.restoredFrom?.previous.heartbeatInterval).toBe(720);

      // HEX EXACTO de la trama de restauración:
      //   02              CMD Configure
      //   02 82 01        shockDetectionSwitch=true
      //   02 86 01        manDownDetectionSwitch=true
      //   02 88 01        tamperAlarmSwitch=true
      //   05 08 00 00 02 D0  heartbeatInterval=720 (BE 0x000002D0)
      const created = downlinkRepo.create.mock.calls[0][0] as { payloadHex: string };
      expect(created.payloadHex).toBe('020282010286010288010508000002D0');
    });

    it('disable: HEX exacto de restauración con heartbeat=300 (snapshot tomado durante ALERTA_ROBO)', async () => {
      remoteCfgRepo.findByDevice.mockResolvedValue({
        idDevice: DEVICE.id,
        idTenant: TENANT,
        desired: {},
        confirmed: {},
        diagnosticState: {
          active: true,
          enabledAt: '2026-05-07T20:00:00.000Z',
          expiresAt: '2026-05-07T20:30:00.000Z',
          previous: {
            shockDetectionSwitch: true,
            manDownDetectionSwitch: true,
            tamperAlarmSwitch: true,
            heartbeatInterval: 300, // mínimo MOKO
          },
          enabledByUserId: null,
          ttlMinutes: 30,
        },
      });

      await service.disableDiagnosticMode({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
      });

      const created = downlinkRepo.create.mock.calls[0][0] as { payloadHex: string };
      // 300 = 0x012C → BE 4 bytes = 00 00 01 2C.
      expect(created.payloadHex).toBe('0202820102860102880105080000012C');
    });

    it('disable: idempotente cuando no hay diagnostic_state activo', async () => {
      remoteCfgRepo.findByDevice.mockResolvedValue({
        idDevice: DEVICE.id,
        idTenant: TENANT,
        desired: {},
        confirmed: {},
        diagnosticState: null,
      });
      const r = await service.disableDiagnosticMode({
        deveui: DEVICE.deveui,
        idTenant: TENANT,
      });
      expect(r.command).toBeNull();
      expect(r.restoredFrom).toBeNull();
      expect(chirpstack.enqueue).not.toHaveBeenCalled();
      expect(remoteCfgRepo.setDiagnosticState).not.toHaveBeenCalled();
    });

    it('runDiagnosticAutoRestoreOnce: restaura todos los devices vencidos', async () => {
      const expiredCfgs = [
        {
          idDevice: 'dev-1',
          idTenant: TENANT,
          desired: {},
          confirmed: {},
          diagnosticState: {
            active: true,
            enabledAt: '2026-05-07T19:00:00.000Z',
            expiresAt: '2026-05-07T19:30:00.000Z',
            previous: {
              shockDetectionSwitch: true,
              manDownDetectionSwitch: true,
              tamperAlarmSwitch: true,
              heartbeatInterval: 720,
            },
            enabledByUserId: null,
            ttlMinutes: 30,
          },
        },
        {
          idDevice: 'dev-2',
          idTenant: TENANT,
          desired: {},
          confirmed: {},
          diagnosticState: {
            active: true,
            enabledAt: '2026-05-07T19:00:00.000Z',
            expiresAt: '2026-05-07T19:35:00.000Z',
            previous: {
              shockDetectionSwitch: true,
              manDownDetectionSwitch: true,
              tamperAlarmSwitch: true,
              heartbeatInterval: 360,
            },
            enabledByUserId: null,
            ttlMinutes: 30,
          },
        },
      ];
      remoteCfgRepo.findExpiredDiagnosticModes.mockResolvedValue(expiredCfgs);

      // findByIdAndTenantId del cron: devuelve un device sintético que comparte el id
      // con el cfg expired (necesario para que disable use el id correcto en setDiagnosticState).
      deviceRepo.findByIdAndTenantId.mockImplementation(
        async (id: string, _idTenant: string) => ({
          ...DEVICE,
          id,
          deveui: id === 'dev-1' ? 'AAAA1111' : 'BBBB2222',
        }),
      );

      // findByDevEuiAndTenantId del disable: devuelve el device para que el id en
      // setDiagnosticState coincida con el del cfg.
      deviceRepo.findByDevEuiAndTenantId.mockImplementation(
        async (deveui: string, _idTenant: string) => ({
          ...DEVICE,
          id: deveui === 'AAAA1111' ? 'dev-1' : 'dev-2',
          deveui,
        }),
      );

      // findByDevice del disable: itera sobre los 2 cfg expired.
      let findCallIdx = 0;
      remoteCfgRepo.findByDevice.mockImplementation(async () => {
        const cfg = expiredCfgs[findCallIdx++];
        return cfg;
      });

      const r = await service.runDiagnosticAutoRestoreOnce();

      expect(r.restored).toBe(2);
      expect(remoteCfgRepo.setDiagnosticState).toHaveBeenCalledTimes(2);
      expect(remoteCfgRepo.setDiagnosticState).toHaveBeenCalledWith('dev-1', null);
      expect(remoteCfgRepo.setDiagnosticState).toHaveBeenCalledWith('dev-2', null);
      expect(chirpstack.enqueue).toHaveBeenCalledTimes(2);
    });

    it('runDiagnosticAutoRestoreOnce: omite devices eliminados sin lanzar', async () => {
      remoteCfgRepo.findExpiredDiagnosticModes.mockResolvedValue([
        {
          idDevice: 'dev-deleted',
          idTenant: TENANT,
          desired: {},
          confirmed: {},
          diagnosticState: {
            active: true,
            enabledAt: '2026-05-07T19:00:00.000Z',
            expiresAt: '2026-05-07T19:30:00.000Z',
            previous: {
              shockDetectionSwitch: true,
              manDownDetectionSwitch: true,
              tamperAlarmSwitch: true,
              heartbeatInterval: 720,
            },
            enabledByUserId: null,
            ttlMinutes: 30,
          },
        },
      ]);
      deviceRepo.findByIdAndTenantId.mockRejectedValueOnce(
        new NotFoundException('device removed'),
      );

      const r = await service.runDiagnosticAutoRestoreOnce();
      expect(r.restored).toBe(0);
      expect(chirpstack.enqueue).not.toHaveBeenCalled();
    });
  });
});
