import { Lw001BgProUplinkParserService } from './lw001-bg-pro-uplink-parser.service';

const fromHex = (hex: string): Buffer => Buffer.from(hex.replace(/\s+/g, ''), 'hex');

const encodeLatLng = (degrees: number): Buffer => {
  const buf = Buffer.alloc(4);
  buf.writeInt32BE(Math.round(degrees * 1e7));
  return buf;
};

describe('Lw001BgProUplinkParserService', () => {
  const parser = new Lw001BgProUplinkParserService();

  describe('decodeCommonHeader', () => {
    it('decodifica periodic + low battery + ack=5 + battery 3.0V + temp 28°C', () => {
      const header = parser.decodeCommonHeader(fromHex('05 1C 85'));
      expect(header).toEqual({
        operationMode: 'periodic',
        lowBattery: true,
        tamperTriggered: false,
        manDownIdle: false,
        motionSinceLast: false,
        positioningTriggeredByDownlink: false,
        temperatureCelsius: 28,
        ack: 5,
        batteryVoltageV: 3.0,
      });
    });

    it('decodifica temperatura negativa (signed)', () => {
      const header = parser.decodeCommonHeader(fromHex('00 E6 00'));
      expect(header.temperatureCelsius).toBe(-26);
    });

    it('detecta tamper + man-down + motion + positioningByDownlink + bateria 3.2V', () => {
      // bits: tamper(3)+manDown(4)+motion(5)+posByDownlink(6) | mode standby(0..1=00)
      // = 0b1111000 = 0x78. Battery nibble = 1010 (3.2V), ack 0
      const header = parser.decodeCommonHeader(fromHex('78 00 A0'));
      expect(header.tamperTriggered).toBe(true);
      expect(header.manDownIdle).toBe(true);
      expect(header.motionSinceLast).toBe(true);
      expect(header.positioningTriggeredByDownlink).toBe(true);
      expect(header.operationMode).toBe('standby');
      expect(header.batteryVoltageV).toBe(3.2);
      expect(header.ack).toBe(0);
    });

    it('falla si buffer < 3 bytes', () => {
      expect(() => parser.decodeCommonHeader(fromHex('05 1C'))).toThrow(/too short/);
    });
  });

  describe('parse() — buffer too short', () => {
    it('retorna { ok:false } sin lanzar', () => {
      const result = parser.parse(1, fromHex('05 1C'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toMatch(/too short/);
      }
    });
  });

  describe('Heartbeat (Port 1)', () => {
    it('decodifica heartbeat con reason=ble_cmd, FW V1.0.3, activeStateCount=10', () => {
      const r = parser.parse(1, fromHex('05 1C 85 01 43 00 00 00 0A'));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.type).toBe('heartbeat');
      if (r.type !== 'heartbeat') return;
      expect(r.reason).toBe('ble_cmd');
      expect(r.firmwareVersion).toBe('V1.0.3');
      expect(r.activeStateCount).toBe(10);
    });

    it('detecta respuesta a Read parameters cuando los bytes encajan en bloques Length+ID+Value', () => {
      // 05 1C 85 02 06 02 → header + (length=2, id=06, value=02)
      const r = parser.parse(1, fromHex('05 1C 85 02 06 02'));
      expect(r.ok).toBe(true);
      if (!r.ok || r.type !== 'heartbeat') return;
      expect(r.parameters).toBeDefined();
      expect(r.parameters).toHaveLength(1);
      expect(r.parameters?.[0]).toMatchObject({
        id: 0x06,
        name: 'workingMode',
        length: 2,
        valueHex: '02',
      });
    });

    it('decodifica respuesta múltiple (timezone + login password ASCII)', () => {
      // header + (length=2, id=04, value=08) + (length=9, id=05, value=Moko4321)
      const r = parser.parse(1, fromHex('05 1C 85 02 04 08 09 05 4D 6F 6B 6F 34 33 32 31'));
      expect(r.ok).toBe(true);
      if (!r.ok || r.type !== 'heartbeat') return;
      expect(r.parameters).toHaveLength(2);
      expect(r.parameters?.[0]).toMatchObject({ id: 0x04, length: 2, valueHex: '08' });
      expect(r.parameters?.[1]).toMatchObject({
        id: 0x05,
        length: 9,
        valueHex: '4D 6F 6B 6F 34 33 32 31',
      });
      // Confirma que es ASCII "Moko4321".
      expect(r.parameters?.[1].value.toString('ascii')).toBe('Moko4321');
    });
  });

  describe('Shutdown (Port 4)', () => {
    it('decodifica shutdown LoRa-cmd', () => {
      const r = parser.parse(4, fromHex('05 1C 85 01'));
      expect(r.ok).toBe(true);
      if (!r.ok || r.type !== 'shutdown') return;
      expect(r.shutdownType).toBe('lora_cmd');
    });

    it('decodifica shutdown magnet', () => {
      const r = parser.parse(4, fromHex('05 1C 85 02'));
      if (!r.ok || r.type !== 'shutdown') {
        throw new Error('expected shutdown');
      }
      expect(r.shutdownType).toBe('magnet');
    });
  });

  describe('Shock (Port 5)', () => {
    it('decodifica numberOfShocks=10 (BE u16)', () => {
      const r = parser.parse(5, fromHex('05 1C 85 00 0A'));
      if (!r.ok || r.type !== 'shock') {
        throw new Error('expected shock');
      }
      expect(r.numberOfShocks).toBe(10);
    });
  });

  describe('Man Down (Port 6)', () => {
    it('decodifica idle=100h (BE u16)', () => {
      const r = parser.parse(6, fromHex('05 1C 85 00 64'));
      if (!r.ok || r.type !== 'man_down') {
        throw new Error('expected man_down');
      }
      expect(r.totalIdleTimeH).toBe(100);
    });
  });

  describe('Tamper Alarm (Port 7)', () => {
    it('decodifica timestamp 2024-08-16 14:30:00 UTC+8', () => {
      // 07 E8 = 2024 ; 08 = month ; 10 = day ; 0E = 14h ; 1E = 30m ; 00 = 0s ; 08 = +8
      const r = parser.parse(7, fromHex('05 1C 85 07 E8 08 10 0E 1E 00 08'));
      if (!r.ok || r.type !== 'tamper_alarm') {
        throw new Error('expected tamper_alarm');
      }
      expect(r.timestamp.toISOString()).toBe('2024-08-16T14:30:00.000Z');
      expect(r.timeZone).toBe(8);
    });

    it('decodifica timezone negativo (UTC-10)', () => {
      const r = parser.parse(7, fromHex('05 1C 85 07 E8 01 01 00 00 00 F6'));
      if (!r.ok || r.type !== 'tamper_alarm') {
        throw new Error('expected tamper_alarm');
      }
      expect(r.timeZone).toBe(-10);
    });
  });

  describe('Event Message (Port 8)', () => {
    it('decodifica triggered_by_downlink (0x03)', () => {
      const r = parser.parse(8, fromHex('05 1C 85 03'));
      if (!r.ok || r.type !== 'event_message') {
        throw new Error('expected event_message');
      }
      expect(r.eventType).toBe('triggered_by_downlink');
      expect(r.eventCode).toBe(3);
    });

    it.each([
      [0x00, 'start_of_movement'],
      [0x01, 'in_movement'],
      [0x02, 'end_of_movement'],
    ] as const)('decodifica eventCode 0x%s como %s', (code, expected) => {
      const hex = `05 1C 85 ${code.toString(16).padStart(2, '0')}`;
      const r = parser.parse(8, fromHex(hex));
      if (!r.ok || r.type !== 'event_message') {
        throw new Error('expected event_message');
      }
      expect(r.eventType).toBe(expected);
    });

    it('rechaza eventType desconocido devolviendo error', () => {
      const r = parser.parse(8, fromHex('05 1C 85 FE'));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toMatch(/unknown event type/);
      }
    });
  });

  describe('Battery Consumption (Port 9)', () => {
    it('decodifica los 5 contadores BE u32 en segundos', () => {
      const r = parser.parse(
        9,
        fromHex(
          // header                gpsTime         wifi            btScan          btBcast         lora
          '05 1C 85 00 00 0E 10  00 00 07 08  00 00 03 84  00 00 01 90  00 00 1F 40',
        ),
      );
      if (!r.ok || r.type !== 'battery_consumption') {
        throw new Error('expected battery_consumption');
      }
      expect(r.gpsTimeS).toBe(3600);
      expect(r.wifiTimeS).toBe(1800);
      expect(r.btScanTimeS).toBe(900);
      expect(r.btBroadcastTimeS).toBe(400);
      expect(r.loraTimeS).toBe(8000);
    });
  });

  describe('Location Fixed (Port 2)', () => {
    it('decodifica GPS fix con timestamp + lat/lng/PDOP', () => {
      const lat = 40.7128;
      const lng = -74.006;
      const buf = Buffer.concat([
        fromHex('05 1C 85'),
        fromHex('02'),
        fromHex('07 E8 08 10 0E 1E 00'),
        fromHex('08'),
        fromHex('09'),
        encodeLatLng(lat),
        encodeLatLng(lng),
        fromHex('0F'),
      ]);
      const r = parser.parse(2, buf);
      if (!r.ok || r.type !== 'location_fixed') {
        throw new Error('expected location_fixed');
      }
      expect(r.positioningType).toBe('gps');
      expect(r.timestamp.toISOString()).toBe('2024-08-16T14:30:00.000Z');
      expect(r.timeZone).toBe(8);
      if (r.data.positioningType !== 'gps') {
        throw new Error('expected gps positioning');
      }
      expect(r.data.latitude).toBeCloseTo(lat, 4);
      expect(r.data.longitude).toBeCloseTo(lng, 4);
      expect(r.data.pdop).toBeCloseTo(1.5, 1);
    });

    it('decodifica WiFi fix con lista de MAC + RSSI', () => {
      // posType=00, ts y tz cualesquiera, len=14 (2 entradas de 7 bytes)
      const buf = Buffer.concat([
        fromHex('05 1C 85'),
        fromHex('00'),
        fromHex('07 E8 08 10 0E 1E 00'),
        fromHex('08'),
        fromHex('0E'),
        fromHex('11 22 33 44 55 66 BF'), // MAC1 + RSSI -65
        fromHex('AA BB CC DD EE FF C0'), // MAC2 + RSSI -64
      ]);
      const r = parser.parse(2, buf);
      if (!r.ok || r.type !== 'location_fixed') {
        throw new Error('expected location_fixed');
      }
      expect(r.positioningType).toBe('wifi');
      if (r.data.positioningType !== 'wifi') {
        throw new Error('expected wifi positioning');
      }
      expect(r.data.devices).toHaveLength(2);
      expect(r.data.devices[0]).toEqual({ mac: '11:22:33:44:55:66', rssi: -65 });
      expect(r.data.devices[1]).toEqual({ mac: 'AA:BB:CC:DD:EE:FF', rssi: -64 });
    });
  });

  describe('Location Failure (Port 3)', () => {
    it('decodifica reason=gps_aiding_timeout y conserva data raw', () => {
      const r = parser.parse(3, fromHex('05 1C 85 0A 05 FF 32 30 28 1A'));
      if (!r.ok || r.type !== 'location_failure') {
        throw new Error('expected location_failure');
      }
      expect(r.reasonCode).toBe(0x0a);
      expect(r.reason).toBe('gps_aiding_timeout');
      expect(r.failureData.raw).toBe('FF 32 30 28 1A');
    });

    it('reason desconocido produce "unknown"', () => {
      const r = parser.parse(3, fromHex('05 1C 85 99 00'));
      if (!r.ok || r.type !== 'location_failure') {
        throw new Error('expected location_failure');
      }
      expect(r.reason).toBe('unknown');
    });
  });

  describe('GPS Limit (Port 12) — sin common header', () => {
    it('decodifica deviceStatus + ack&battery + lat + lng + pdop', () => {
      const lat = 40.7128;
      const lng = -74.006;
      const buf = Buffer.concat([
        fromHex('05 A5'), // deviceStatus 0x05 + ackBattery 0xA5 (ack=5, battery nibble 0xA → 3.2V)
        encodeLatLng(lat),
        encodeLatLng(lng),
        fromHex('0F'),
      ]);
      const r = parser.parse(12, buf);
      if (!r.ok || r.type !== 'gps_limit') {
        throw new Error('expected gps_limit');
      }
      expect(r.deviceStatusByte).toBe(0x05);
      expect(r.ack).toBe(5);
      expect(r.batteryVoltageV).toBe(3.2);
      expect(r.latitude).toBeCloseTo(lat, 4);
      expect(r.longitude).toBeCloseTo(lng, 4);
      expect(r.pdop).toBeCloseTo(1.5, 1);
    });

    it('payload demasiado corto retorna error', () => {
      const r = parser.parse(12, fromHex('05 A5 00'));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toMatch(/too short/);
      }
    });
  });

  describe('Read Response (Port 10) — respuesta a CMD Read parameters', () => {
    // HEX reales capturados desde el collar MOKO LW001-BG PRO en producción.
    // Cabecera común `XX YY ZZ` (3 bytes) + secuencia TLV `Length+ID+Value`.

    it('Bloque 1 (General): decodifica los 9 parámetros 0x04..0x0d', () => {
      const hex = '011de60204fb02060202070005080000012c020901020a01020b00020c03030dffff';
      const r = parser.parse(10, fromHex(hex));
      if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`);
      expect(r.type).toBe('read_response');
      if (r.type !== 'read_response') return;

      expect(r.header).not.toBeNull();
      expect(r.header?.operationMode).toBe('periodic');
      expect(r.header?.temperatureCelsius).toBe(29);
      expect(r.header?.ack).toBe(6);
      expect(r.header?.batteryVoltageV).toBe(3.6);

      expect(r.parameters).toHaveLength(9);
      expect(r.parameters?.[0]).toMatchObject({ id: 0x04, name: 'timeZone', length: 2, valueHex: 'FB' });
      expect(r.parameters?.[1]).toMatchObject({ id: 0x06, name: 'workingMode', length: 2, valueHex: '02' });
      expect(r.parameters?.[2]).toMatchObject({ id: 0x07, length: 2, valueHex: '00' });
      expect(r.parameters?.[3]).toMatchObject({ id: 0x08, length: 5, valueHex: '00 00 01 2C' });
      expect(r.parameters?.[4]).toMatchObject({ id: 0x09, length: 2, valueHex: '01' });
      expect(r.parameters?.[5]).toMatchObject({ id: 0x0a, length: 2, valueHex: '01' });
      expect(r.parameters?.[6]).toMatchObject({ id: 0x0b, length: 2, valueHex: '00' });
      expect(r.parameters?.[7]).toMatchObject({ id: 0x0c, length: 2, valueHex: '03' });
      expect(r.parameters?.[8]).toMatchObject({ id: 0x0d, length: 3, valueHex: 'FF FF' });
    });

    it('Bloque 3 (WiFi/Bluetooth básico + filtros globales): 9 parámetros', () => {
      const hex = '011ceb023001023103023205023303023400023500023c81023e00024581';
      const r = parser.parse(10, fromHex(hex));
      if (!r.ok || r.type !== 'read_response') {
        throw new Error('expected read_response');
      }
      const ids = (r.parameters ?? []).map((p) => p.id);
      expect(ids).toEqual([0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x3c, 0x3e, 0x45]);
      expect(r.parameters?.[0]).toMatchObject({ id: 0x30, valueHex: '01' });
      expect(r.parameters?.[6]).toMatchObject({ id: 0x3c, valueHex: '81' });
      expect(r.parameters?.[8]).toMatchObject({ id: 0x45, valueHex: '81' });
    });

    it('Bloque 5 (Filtros BLE B): 6 parámetros 0x3f..0x44', () => {
      const hex = '011cee023f00024000024100024200024300024400';
      const r = parser.parse(10, fromHex(hex));
      if (!r.ok || r.type !== 'read_response') {
        throw new Error('expected read_response');
      }
      expect((r.parameters ?? []).map((p) => p.id)).toEqual([0x3f, 0x40, 0x41, 0x42, 0x43, 0x44]);
      expect(r.parameters?.every((p) => p.valueHex === '00')).toBe(true);
    });

    it('Bloque 10 (Password Bluetooth): id=0x05 con valor ASCII "Moko4321"', () => {
      const hex = '011be709054d6f6b6f34333231';
      const r = parser.parse(10, fromHex(hex));
      if (!r.ok || r.type !== 'read_response') {
        throw new Error('expected read_response');
      }
      expect(r.parameters).toHaveLength(1);
      expect(r.parameters?.[0]).toMatchObject({
        id: 0x05,
        name: 'loginPassword',
        length: 9,
        valueHex: '4D 6F 6B 6F 34 33 32 31',
      });
      expect(r.parameters?.[0].value.toString('ascii')).toBe('Moko4321');
    });

    it('payload sin TLV válido tras el header se reporta como read_response con parameters=[]', () => {
      // Header válido pero los siguientes bytes no encajan como Length+ID+Value (Length=0).
      const r = parser.parse(10, fromHex('01 1C E6 00 00'));
      if (!r.ok || r.type !== 'read_response') {
        throw new Error('expected read_response');
      }
      expect(r.parameters).toEqual([]);
    });

    it('payload demasiado corto en fPort 10 reporta error', () => {
      const r = parser.parse(10, fromHex('01 1C'));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/too short/);
    });
  });

  describe('puerto desconocido', () => {
    it('retorna type=unknown sin lanzar', () => {
      const r = parser.parse(99, fromHex('05 1C 85 AA BB'));
      if (!r.ok) {
        throw new Error('expected ok');
      }
      expect(r.type).toBe('unknown');
      expect(r.fPort).toBe(99);
    });
  });
});
