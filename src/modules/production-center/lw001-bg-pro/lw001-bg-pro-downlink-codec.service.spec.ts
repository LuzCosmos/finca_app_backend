import { Lw001BgProDownlinkCodecService } from './lw001-bg-pro-downlink-codec.service';

describe('Lw001BgProDownlinkCodecService', () => {
  const codec = new Lw001BgProDownlinkCodecService();

  const hex = (b: Buffer) => codec.toHex(b);

  describe('helpers', () => {
    it('toHex formats bytes uppercase with single space', () => {
      expect(codec.toHex(Buffer.of(0, 1, 0xab, 0xcd))).toBe('00 01 AB CD');
    });

    it('toBase64 converts buffer to base64', () => {
      expect(codec.toBase64(Buffer.of(0, 1))).toBe('AAE=');
    });

    it('buildConfigureMultiple requires at least one part', () => {
      expect(() => codec.buildConfigureMultiple([])).toThrow(RangeError);
    });

    it('buildConfigureMultiple rejects buffers not produced by buildConfigure*', () => {
      expect(() => codec.buildConfigureMultiple([Buffer.of(0xff, 0x00, 0x00)])).toThrow(TypeError);
    });
  });

  // ============================================================
  // CONTROL (CMD = 0x00)
  // ============================================================

  describe('buildControlCommand', () => {
    it.each([
      ['reboot', '00 00'],
      ['downlink_position', '00 01'],
      ['enable_bluetooth', '00 02'],
      ['clear_man_down', '00 03'],
      ['request_battery', '00 04'],
      ['factory_reset', '00 05'],
    ] as const)('builds %s as %s', (cmd, expected) => {
      expect(hex(codec.buildControlCommand(cmd))).toBe(expected);
    });

    it('throws on unknown command', () => {
      // @ts-expect-error testing runtime guard
      expect(() => codec.buildControlCommand('unknown')).toThrow(TypeError);
    });
  });

  // ============================================================
  // READ (CMD = 0x01)
  // ============================================================

  describe('buildReadParameters', () => {
    it('reads single parameter', () => {
      expect(hex(codec.buildReadParameters([0x06]))).toBe('01 06');
    });

    it('reads multiple parameters', () => {
      expect(hex(codec.buildReadParameters([0x06, 0x08, 0x20, 0x21]))).toBe('01 06 08 20 21');
    });

    it('rejects empty list', () => {
      expect(() => codec.buildReadParameters([])).toThrow(RangeError);
    });

    it('rejects out-of-byte ids', () => {
      expect(() => codec.buildReadParameters([0x100])).toThrow(RangeError);
      expect(() => codec.buildReadParameters([-1])).toThrow(RangeError);
    });
  });

  // ============================================================
  // CONFIGURE simples (CMD = 0x02)
  // ============================================================

  describe('configure: time zone (ID 0x04)', () => {
    it('UTC+9 → 02 02 04 09', () => {
      expect(hex(codec.buildConfigureTimeZone(9))).toBe('02 02 04 09');
    });

    it('UTC-10 → 02 02 04 F6', () => {
      expect(hex(codec.buildConfigureTimeZone(-10))).toBe('02 02 04 F6');
    });

    it('rejects outside [-12..12]', () => {
      expect(() => codec.buildConfigureTimeZone(15)).toThrow(/range \[-12\.\.12\]/);
      expect(() => codec.buildConfigureTimeZone(-15)).toThrow(/range \[-12\.\.12\]/);
    });
  });

  describe('configure: working mode (ID 0x06)', () => {
    it.each([
      ['standby', '02 02 06 01'],
      ['periodic', '02 02 06 02'],
      ['timing', '02 02 06 03'],
      ['motion', '02 02 06 04'],
    ] as const)('builds %s as %s', (mode, expected) => {
      expect(hex(codec.buildConfigureWorkingMode(mode))).toBe(expected);
    });

    it('throws on invalid mode', () => {
      // @ts-expect-error
      expect(() => codec.buildConfigureWorkingMode('invalid')).toThrow(TypeError);
    });
  });

  describe('configure: heartbeat interval (ID 0x08, BE u32)', () => {
    it.each([
      [600, '02 05 08 00 00 02 58'],
      [1800, '02 05 08 00 00 07 08'],
      [3600, '02 05 08 00 00 0E 10'],
      [43200, '02 05 08 00 00 A8 C0'],
      [86400, '02 05 08 00 01 51 80'],
    ] as const)('builds %is as %s', (s, expected) => {
      expect(hex(codec.buildConfigureHeartbeatInterval(s))).toBe(expected);
    });

    it('rejects out of [300..86400]', () => {
      expect(() => codec.buildConfigureHeartbeatInterval(0)).toThrow(/range \[300\.\.86400\]/);
      expect(() => codec.buildConfigureHeartbeatInterval(299)).toThrow(/range \[300\.\.86400\]/);
      expect(() => codec.buildConfigureHeartbeatInterval(86401)).toThrow(/range \[300\.\.86400\]/);
      expect(() => codec.buildConfigureHeartbeatInterval(100000)).toThrow(/range \[300\.\.86400\]/);
    });
  });

  describe('configure: periodic positioning strategy (ID 0x20)', () => {
    it.each([
      [{ wifi: true, bluetooth: false, gps: false }, '02 02 20 01'],
      [{ wifi: false, bluetooth: true, gps: false }, '02 02 20 02'],
      [{ wifi: false, bluetooth: false, gps: true }, '02 02 20 04'],
      [{ wifi: true, bluetooth: true, gps: true }, '02 02 20 07'],
    ])('builds %j as %s', (strategy, expected) => {
      expect(hex(codec.buildConfigurePeriodicPositioningStrategy(strategy))).toBe(expected);
    });
  });

  describe('configure: periodic report interval (ID 0x21, BE u32)', () => {
    it.each([
      [1800, '02 05 21 00 00 07 08'],
      [3600, '02 05 21 00 00 0E 10'],
      [21600, '02 05 21 00 00 54 60'], // 6h, AHORRO_BATERIA
      [300, '02 05 21 00 00 01 2C'], // ALERTA_ROBO
    ])('builds %is as %s', (s, expected) => {
      expect(hex(codec.buildConfigurePeriodicReportInterval(s))).toBe(expected);
    });

    it('rejects below 30s', () => {
      expect(() => codec.buildConfigurePeriodicReportInterval(10)).toThrow(/range \[30\.\.86400\]/);
    });
  });

  describe('configure: motion mode setting (ID 0x24)', () => {
    it('PDF example bitmask 0x19 (notifyOnStart + fixOnStart=false + fixInTrip + fixOnEnd=false)', () => {
      // 0x19 = 0b00011001 → bit0,bit3,bit4
      expect(
        hex(
          codec.buildConfigureMotionModeSettings({
            notifyEventOnStart: true, // bit 0
            fixOnStart: false, // bit 1
            notifyEventInTrip: false, // bit 2
            fixInTrip: true, // bit 3
            notifyEventOnEnd: true, // bit 4
            fixOnEnd: false, // bit 5
          }),
        ),
      ).toBe('02 02 24 19');
    });

    it('all-true bitmask 0x3F', () => {
      expect(
        hex(
          codec.buildConfigureMotionModeSettings({
            notifyEventOnStart: true,
            fixOnStart: true,
            notifyEventInTrip: true,
            fixInTrip: true,
            notifyEventOnEnd: true,
            fixOnEnd: true,
          }),
        ),
      ).toBe('02 02 24 3F');
    });
  });

  describe('configure: motion report interval in trip (ID 0x27)', () => {
    it('1800s', () => {
      expect(hex(codec.buildConfigureMotionReportIntervalInTrip(1800))).toBe('02 05 27 00 00 07 08');
    });

    it('3600s', () => {
      expect(hex(codec.buildConfigureMotionReportIntervalInTrip(3600))).toBe('02 05 27 00 00 0E 10');
    });

    it('rejects under 10s', () => {
      expect(() => codec.buildConfigureMotionReportIntervalInTrip(5)).toThrow(/range \[10\.\.86400\]/);
    });
  });

  describe('configure: position strategy in trip (ID 0x28)', () => {
    it('GPS only', () => {
      expect(
        hex(
          codec.buildConfigureMotionPositioningStrategyInTrip({
            wifi: false,
            bluetooth: false,
            gps: true,
          }),
        ),
      ).toBe('02 02 28 04');
    });
  });

  describe('configure: trip end timeout (ID 0x29, units of 10s)', () => {
    it('10 units (100s) → 02 02 29 0A', () => {
      expect(hex(codec.buildConfigureTripEndTimeout(10))).toBe('02 02 29 0A');
    });

    it('12 units (120s) → 02 02 29 0C', () => {
      expect(hex(codec.buildConfigureTripEndTimeout(12))).toBe('02 02 29 0C');
    });

    it('rejects out of range', () => {
      expect(() => codec.buildConfigureTripEndTimeout(2)).toThrow(/range \[3\.\.180\]/);
      expect(() => codec.buildConfigureTripEndTimeout(200)).toThrow(/range \[3\.\.180\]/);
    });
  });

  describe('configure: report interval on trip end (ID 0x2B, BE u16)', () => {
    it('300s → 02 03 2B 01 2C', () => {
      expect(hex(codec.buildConfigureReportIntervalOnTripEnd(300))).toBe('02 03 2B 01 2C');
    });

    it('100s → 02 03 2B 00 64', () => {
      expect(hex(codec.buildConfigureReportIntervalOnTripEnd(100))).toBe('02 03 2B 00 64');
    });

    it('rejects > 300', () => {
      expect(() => codec.buildConfigureReportIntervalOnTripEnd(600)).toThrow(/range \[10\.\.300\]/);
    });
  });

  describe('configure: downlink for position strategy (ID 0x2D)', () => {
    it('GPS only', () => {
      expect(
        hex(
          codec.buildConfigureDownlinkForPositionStrategy({
            wifi: false,
            bluetooth: false,
            gps: true,
          }),
        ),
      ).toBe('02 02 2D 04');
    });
  });

  describe('configure: GPS time budget (ID 0x4F, BE u32)', () => {
    it.each([
      [1800, '02 05 4F 00 00 07 08'],
      [3600, '02 05 4F 00 00 0E 10'],
      [7200, '02 05 4F 00 00 1C 20'],
      [14400, '02 05 4F 00 00 38 40'],
      [43200, '02 05 4F 00 00 A8 C0'],
    ] as const)('%is → %s', (s, expected) => {
      expect(hex(codec.buildConfigureGpsTimeBudget(s))).toBe(expected);
    });

    it('rejects > 76200', () => {
      expect(() => codec.buildConfigureGpsTimeBudget(100000)).toThrow(/range \[0\.\.76200\]/);
    });
  });

  describe('configure: WiFi fix timeout (ID 0x30, units of 2s)', () => {
    it('2 units → 02 02 30 02', () => {
      expect(hex(codec.buildConfigureWifiFixTimeout(2))).toBe('02 02 30 02');
    });

    it('rejects > 5', () => {
      expect(() => codec.buildConfigureWifiFixTimeout(6)).toThrow(/range \[1\.\.5\]/);
    });
  });

  describe('configure: time sync (ID 0x6E)', () => {
    it('8h → 02 02 6E 08', () => {
      expect(hex(codec.buildConfigureTimeSyncInterval(8))).toBe('02 02 6E 08');
    });

    it('rejects > 255', () => {
      expect(() => codec.buildConfigureTimeSyncInterval(300)).toThrow(/range \[0\.\.255\]/);
    });
  });

  describe('configure: reconnect (ID 0x6F)', () => {
    it('7 days → 02 02 6F 07', () => {
      expect(hex(codec.buildConfigureReconnectInterval(7))).toBe('02 02 6F 07');
    });

    it('rejects > 30', () => {
      expect(() => codec.buildConfigureReconnectInterval(60)).toThrow(/range \[0\.\.30\]/);
    });
  });

  describe('configure: shock / man down / tamper switches', () => {
    it('shock detection on → 02 02 82 01', () => {
      expect(hex(codec.buildConfigureShockDetectionSwitch(true))).toBe('02 02 82 01');
    });

    it('shock threshold 100mg (10*10mg) → 02 02 83 0A', () => {
      expect(hex(codec.buildConfigureShockThreshold(10))).toBe('02 02 83 0A');
    });

    it('shock report interval 100s → 02 02 84 64', () => {
      expect(hex(codec.buildConfigureShockReportInterval(100))).toBe('02 02 84 64');
    });

    it('shock timeout 5s → 02 02 85 05', () => {
      expect(hex(codec.buildConfigureShockTimeout(5))).toBe('02 02 85 05');
    });

    it('man down detection on → 02 02 86 01', () => {
      expect(hex(codec.buildConfigureManDownDetectionSwitch(true))).toBe('02 02 86 01');
    });

    it('idle detection 100h → 02 03 87 00 64', () => {
      expect(hex(codec.buildConfigureIdleDetectionTimeout(100))).toBe('02 03 87 00 64');
    });

    it('tamper alarm on → 02 02 88 01', () => {
      expect(hex(codec.buildConfigureTamperAlarmSwitch(true))).toBe('02 02 88 01');
    });

    it('active state count on → 02 02 89 01', () => {
      expect(hex(codec.buildConfigureActiveStateCountSwitch(true))).toBe('02 02 89 01');
    });

    it('active state timeout 100s → 02 05 8A 00 00 00 64', () => {
      expect(hex(codec.buildConfigureActiveStateTimeout(100))).toBe('02 05 8A 00 00 00 64');
    });
  });

  // ============================================================
  // CONFIGURE combinado (perfiles)
  // ============================================================

  describe('buildConfigureMultiple', () => {
    it('compone perfil NORMAL_1H', () => {
      const buffer = codec.buildConfigureMultiple([
        codec.buildConfigureWorkingMode('periodic'),
        codec.buildConfigurePeriodicPositioningStrategy({ wifi: false, bluetooth: false, gps: true }),
        codec.buildConfigurePeriodicReportInterval(3600),
        codec.buildConfigureHeartbeatInterval(43200),
        codec.buildConfigureGpsTimeBudget(3600),
      ]);
      expect(hex(buffer)).toBe(
        '02 02 06 02 02 20 04 05 21 00 00 0E 10 05 08 00 00 A8 C0 05 4F 00 00 0E 10',
      );
    });

    it('compone perfil SEGUIMIENTO_30MIN', () => {
      const buffer = codec.buildConfigureMultiple([
        codec.buildConfigureWorkingMode('periodic'),
        codec.buildConfigurePeriodicPositioningStrategy({ wifi: false, bluetooth: false, gps: true }),
        codec.buildConfigurePeriodicReportInterval(1800),
        codec.buildConfigureHeartbeatInterval(43200),
        codec.buildConfigureGpsTimeBudget(7200),
      ]);
      expect(hex(buffer)).toBe(
        '02 02 06 02 02 20 04 05 21 00 00 07 08 05 08 00 00 A8 C0 05 4F 00 00 1C 20',
      );
    });

    it('compone perfil ALERTA_ROBO', () => {
      const buffer = codec.buildConfigureMultiple([
        codec.buildConfigureWorkingMode('periodic'),
        codec.buildConfigurePeriodicPositioningStrategy({ wifi: false, bluetooth: false, gps: true }),
        codec.buildConfigurePeriodicReportInterval(300),
        codec.buildConfigureHeartbeatInterval(3600),
        codec.buildConfigureGpsTimeBudget(14400),
      ]);
      expect(hex(buffer)).toBe(
        '02 02 06 02 02 20 04 05 21 00 00 01 2C 05 08 00 00 0E 10 05 4F 00 00 38 40',
      );
    });

    it('compone perfil AHORRO_BATERIA', () => {
      const buffer = codec.buildConfigureMultiple([
        codec.buildConfigureWorkingMode('periodic'),
        codec.buildConfigurePeriodicPositioningStrategy({ wifi: false, bluetooth: false, gps: true }),
        codec.buildConfigurePeriodicReportInterval(21600),
        codec.buildConfigureHeartbeatInterval(43200),
        codec.buildConfigureGpsTimeBudget(1800),
      ]);
      expect(hex(buffer)).toBe(
        '02 02 06 02 02 20 04 05 21 00 00 54 60 05 08 00 00 A8 C0 05 4F 00 00 07 08',
      );
    });

    it('compone perfil MOVIMIENTO_1H', () => {
      const buffer = codec.buildConfigureMultiple([
        codec.buildConfigureWorkingMode('motion'),
        codec.buildConfigureMotionModeSettings({
          notifyEventOnStart: true,
          fixOnStart: false,
          notifyEventInTrip: false,
          fixInTrip: true,
          notifyEventOnEnd: true,
          fixOnEnd: false,
        }),
        codec.buildConfigureMotionReportIntervalInTrip(3600),
        codec.buildConfigureMotionPositioningStrategyInTrip({ wifi: false, bluetooth: false, gps: true }),
        codec.buildConfigureTripEndTimeout(12),
        codec.buildConfigureReportIntervalOnTripEnd(300),
      ]);
      expect(hex(buffer)).toBe(
        '02 02 06 04 02 24 19 05 27 00 00 0E 10 02 28 04 02 29 0C 03 2B 01 2C',
      );
    });
  });

  // ============================================================
  // LOCAL STORAGE (fPort 11)
  // ============================================================

  describe('buildLocalStorageCommand', () => {
    it('upload last 5 days → 00 00 05', () => {
      expect(hex(codec.buildLocalStorageCommand({ action: 'upload', lastDays: 5 }))).toBe('00 00 05');
    });

    it('upload last 30 days → 00 00 1E', () => {
      expect(hex(codec.buildLocalStorageCommand({ action: 'upload', lastDays: 30 }))).toBe('00 00 1E');
    });

    it('upload all (65535) → 00 FF FF', () => {
      expect(hex(codec.buildLocalStorageCommand({ action: 'upload', lastDays: 65_535 }))).toBe('00 FF FF');
    });

    it('rejects upload with lastDays out of range', () => {
      expect(() => codec.buildLocalStorageCommand({ action: 'upload', lastDays: 70_000 })).toThrow(
        /range \[1\.\.65535\]/,
      );
      expect(() => codec.buildLocalStorageCommand({ action: 'upload', lastDays: 0 })).toThrow(
        /range \[1\.\.65535\]/,
      );
    });

    it('clear all → 01', () => {
      expect(hex(codec.buildLocalStorageCommand({ action: 'clear' }))).toBe('01');
    });

    it('pause → 02', () => {
      expect(hex(codec.buildLocalStorageCommand({ action: 'pause' }))).toBe('02');
    });

    it('resume → 03', () => {
      expect(hex(codec.buildLocalStorageCommand({ action: 'resume' }))).toBe('03');
    });

    it('rejects unknown action', () => {
      // @ts-expect-error
      expect(() => codec.buildLocalStorageCommand({ action: 'foo' })).toThrow(TypeError);
    });
  });

  // ============================================================
  // EXTRA: filtros, timing, BLE beacon
  // ============================================================

  describe('extras', () => {
    it('timing report points 00:15 + 00:45 → 02 03 23 01 03', () => {
      expect(hex(codec.buildConfigureTimingReportPoints([1, 3]))).toBe('02 03 23 01 03');
    });

    it('rejects more than 10 timing points', () => {
      expect(() => codec.buildConfigureTimingReportPoints([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toThrow(
        /count out of range/,
      );
    });

    it('coarse accuracy 100m → 02 02 48 64', () => {
      expect(hex(codec.buildConfigureCoarseAccuracyMask(100))).toBe('02 02 48 64');
    });

    it('fix mode 3D → 02 02 4D 01', () => {
      expect(hex(codec.buildConfigureFixMode('3d'))).toBe('02 02 4D 01');
    });

    it('GPS model Stationary → 02 02 4E 01', () => {
      expect(hex(codec.buildConfigureGpsModel('stationary'))).toBe('02 02 4E 01');
    });

    it('region EU868 → 02 02 60 05', () => {
      expect(hex(codec.buildConfigureRegion('eu868'))).toBe('02 02 60 05');
    });

    it('LoRaWAN OTAA → 02 02 61 02', () => {
      expect(hex(codec.buildConfigureLorawanMode('otaa'))).toBe('02 02 61 02');
    });

    it('beacon mode on → 02 02 70 01', () => {
      expect(hex(codec.buildConfigureBtBeaconModeSwitch(true))).toBe('02 02 70 01');
    });

    it('beacon ADV interval 1000ms (10*100ms) → 02 02 71 0A', () => {
      expect(hex(codec.buildConfigureBtAdvIntervalBeacon(10))).toBe('02 02 71 0A');
    });

    it('measured power -65dBm → 02 02 77 BF', () => {
      expect(hex(codec.buildConfigureBtMeasuredPower(-65))).toBe('02 02 77 BF');
    });

    it('BT TX power 4dB → 02 02 78 04', () => {
      expect(hex(codec.buildConfigureBtTxPower(4))).toBe('02 02 78 04');
    });

    it('BT TX power -8dB → 02 02 78 F8', () => {
      expect(hex(codec.buildConfigureBtTxPower(-8))).toBe('02 02 78 F8');
    });

    it('rejects BT TX power 1dB', () => {
      expect(() => codec.buildConfigureBtTxPower(1)).toThrow(/not in valid set/);
    });

    it('beacon ADV name "LW001-BG-35BB" → 02 0E 79 ...', () => {
      expect(hex(codec.buildConfigureBtAdvName('LW001-BG-35BB'))).toBe(
        '02 0E 79 4C 57 30 30 31 2D 42 47 2D 33 35 42 42',
      );
    });

    it('accel wakeup 48mg + 50ms → 02 03 80 03 05', () => {
      expect(hex(codec.buildConfigureAccelWakeup(3, 5))).toBe('02 03 80 03 05');
    });

    it('accel motion 20mg + 40ms → 02 03 81 0A 08', () => {
      expect(hex(codec.buildConfigureAccelMotion(10, 8))).toBe('02 03 81 0A 08');
    });
  });
});
