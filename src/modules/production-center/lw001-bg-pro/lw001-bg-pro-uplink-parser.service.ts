import { Injectable } from '@nestjs/common';
import {
  LW001_BG_PRO_PARAM_ID_TO_NAME,
  LW001_BG_PRO_UPLINK_PORTS,
} from './lw001-bg-pro.constants';
import {
  Lw001BgProBatteryConsumptionPayload,
  Lw001BgProCommonHeader,
  Lw001BgProEventMessagePayload,
  Lw001BgProEventType,
  Lw001BgProGpsLimitPayload,
  Lw001BgProHeartbeatReason,
  Lw001BgProLocationFailurePayload,
  Lw001BgProLocationFixedPayload,
  Lw001BgProManDownPayload,
  Lw001BgProOperationMode,
  Lw001BgProPositioningSuccessType,
  Lw001BgProReadParameter,
  Lw001BgProReadResponsePayload,
  Lw001BgProShockPayload,
  Lw001BgProShutdownPayload,
  Lw001BgProShutdownType,
  Lw001BgProTamperAlarmPayload,
  Lw001BgProUnknownPayload,
  Lw001BgProUplinkHeartbeat,
  Lw001BgProUplinkParseResult,
} from './lw001-bg-pro.types';

const COMMON_HEADER_BYTES = 3;

const OPERATION_MODE_MAP: Record<number, Lw001BgProOperationMode> = {
  0b00: 'standby',
  0b01: 'periodic',
  0b10: 'timing',
  0b11: 'motion',
};

const SHUTDOWN_TYPE_MAP: Record<number, Lw001BgProShutdownType> = {
  0x00: 'ble_cmd',
  0x01: 'lora_cmd',
  0x02: 'magnet',
};

const EVENT_TYPE_MAP: Record<number, Lw001BgProEventType> = {
  0x00: 'start_of_movement',
  0x01: 'in_movement',
  0x02: 'end_of_movement',
  0x03: 'triggered_by_downlink',
};

const HEARTBEAT_REASON_MAP: Record<number, Lw001BgProHeartbeatReason> = {
  0x00: 'power_failure_restart',
  0x01: 'ble_cmd',
  0x02: 'lora_cmd',
  0x03: 'normal_power_on',
};

const POSITIONING_SUCCESS_TYPE_MAP: Record<number, Lw001BgProPositioningSuccessType> = {
  0x00: 'wifi',
  0x01: 'bluetooth',
  0x02: 'gps',
};

const LOCATION_FAILURE_REASON_MAP: Record<number, string> = {
  0x00: 'wifi_positioning_time_not_enough',
  0x01: 'wifi_positioning_strategies_timeout',
  0x02: 'wifi_module_not_detected',
  0x03: 'bt_positioning_time_not_enough',
  0x04: 'bt_positioning_strategies_timeout',
  0x05: 'bt_broadcasting_in_progress',
  0x06: 'gps_position_time_budget_over',
  0x07: 'gps_coarse_positioning_timeout',
  0x08: 'gps_fine_positioning_timeout',
  0x09: 'gps_positioning_time_not_enough',
  0x0a: 'gps_aiding_timeout',
  0x0b: 'gps_cold_start_timeout',
  0x0c: 'interrupted_by_downlink_for_position',
  0x0d: 'interrupted_at_start_of_movement',
  0x0e: 'interrupted_at_end_of_movement',
};

const toHexString = (buffer: Buffer): string =>
  buffer.toString('hex').toUpperCase().match(/.{1,2}/g)?.join(' ') ?? '';

/**
 * Parser puro para uplinks LW001-BG PRO.
 *
 * El parser jamás lanza excepciones — devuelve `{ ok: false, reason: '...' }` cuando el
 * payload está malformado, para que el `MqttService` no se rompa.
 */
@Injectable()
export class Lw001BgProUplinkParserService {
  parse(fPort: number, payload: Buffer): Lw001BgProUplinkParseResult {
    const rawHex = toHexString(payload);

    try {
      switch (fPort) {
        case LW001_BG_PRO_UPLINK_PORTS.HEARTBEAT:
          return this.parseHeartbeat(payload, rawHex);
        case LW001_BG_PRO_UPLINK_PORTS.LOCATION_FIXED:
          return this.parseLocationFixed(payload, rawHex);
        case LW001_BG_PRO_UPLINK_PORTS.LOCATION_FAILURE:
          return this.parseLocationFailure(payload, rawHex);
        case LW001_BG_PRO_UPLINK_PORTS.SHUTDOWN:
          return this.parseShutdown(payload, rawHex);
        case LW001_BG_PRO_UPLINK_PORTS.SHOCK:
          return this.parseShock(payload, rawHex);
        case LW001_BG_PRO_UPLINK_PORTS.MAN_DOWN:
          return this.parseManDown(payload, rawHex);
        case LW001_BG_PRO_UPLINK_PORTS.TAMPER_ALARM:
          return this.parseTamperAlarm(payload, rawHex);
        case LW001_BG_PRO_UPLINK_PORTS.EVENT_MESSAGE:
          return this.parseEventMessage(payload, rawHex);
        case LW001_BG_PRO_UPLINK_PORTS.BATTERY_CONSUMPTION:
          return this.parseBatteryConsumption(payload, rawHex);
        case LW001_BG_PRO_UPLINK_PORTS.GENERAL_COMMANDS_RESPONSE:
          return this.parseReadResponse(payload, rawHex);
        case LW001_BG_PRO_UPLINK_PORTS.GPS_LIMIT:
          return this.parseGpsLimit(payload, rawHex);
        default:
          return this.parseUnknown(fPort, payload, rawHex);
      }
    } catch (e) {
      return {
        ok: false,
        fPort,
        rawHex,
        reason: e instanceof Error ? e.message : 'unknown parse error',
      };
    }
  }

  // ============================================================
  // Common header (3 bytes)
  // ============================================================

  decodeCommonHeader(buffer: Buffer): Lw001BgProCommonHeader {
    if (buffer.length < COMMON_HEADER_BYTES) {
      throw new RangeError('buffer too short for common header');
    }
    const deviceStatus = buffer.readUInt8(0);
    const tempByte = buffer.readUInt8(1);
    const ackBattery = buffer.readUInt8(2);

    return {
      operationMode: OPERATION_MODE_MAP[deviceStatus & 0b11],
      lowBattery: (deviceStatus & (1 << 2)) !== 0,
      tamperTriggered: (deviceStatus & (1 << 3)) !== 0,
      manDownIdle: (deviceStatus & (1 << 4)) !== 0,
      motionSinceLast: (deviceStatus & (1 << 5)) !== 0,
      positioningTriggeredByDownlink: (deviceStatus & (1 << 6)) !== 0,
      temperatureCelsius: tempByte > 128 ? tempByte - 256 : tempByte,
      ack: ackBattery & 0x0f,
      batteryVoltageV: this.decodeBatteryVoltage((ackBattery >> 4) & 0x0f),
    };
  }

  /** 2.2V + 100mV * value. Redondeo a 2 decimales. */
  private decodeBatteryVoltage(rawNibble: number): number {
    return Math.round((2.2 + 0.1 * rawNibble) * 100) / 100;
  }

  // ============================================================
  // Read parameters response — buffer after common header
  // ============================================================

  /**
   * Intenta interpretar los bytes después del common header como respuesta a Read parameters,
   * con forma `Length+ID+Value` repetido. Si no encaja, retorna [].
   */
  tryParseReadResponse(after: Buffer): Lw001BgProReadParameter[] | null {
    if (after.length === 0) return null;
    const params: Lw001BgProReadParameter[] = [];
    let offset = 0;
    while (offset < after.length) {
      const length = after.readUInt8(offset);
      // length representa "ID + Value"; debe ser >= 1.
      if (length < 1 || offset + 1 + length > after.length) {
        return null; // no encaja como respuesta read
      }
      const id = after.readUInt8(offset + 1);
      const valueLen = length - 1;
      const value = after.subarray(offset + 2, offset + 2 + valueLen);
      params.push({
        id,
        name: LW001_BG_PRO_PARAM_ID_TO_NAME[id],
        length,
        value: Buffer.from(value),
        valueHex: toHexString(value),
      });
      offset += 1 + length;
    }
    return params;
  }

  // ============================================================
  // Port-specific parsers
  // ============================================================

  private parseHeartbeat(payload: Buffer, rawHex: string): Lw001BgProUplinkHeartbeat {
    const header = this.decodeCommonHeader(payload);
    const after = payload.subarray(COMMON_HEADER_BYTES);
    let reason: Lw001BgProHeartbeatReason = 'unknown';
    let firmwareVersion = '';
    let activeStateCount = 0;

    if (after.length >= 6) {
      reason = HEARTBEAT_REASON_MAP[after.readUInt8(0)] ?? 'unknown';
      firmwareVersion = this.decodeFirmwareVersion(after.readUInt8(1));
      activeStateCount = after.readUInt32BE(2);
    }

    // Algunos puertos también traen respuesta de read tras el common header.
    const readResponse = this.tryParseReadResponse(after);

    return {
      ok: true,
      fPort: LW001_BG_PRO_UPLINK_PORTS.HEARTBEAT,
      type: 'heartbeat',
      header,
      reason,
      firmwareVersion,
      activeStateCount,
      parameters: readResponse ?? undefined,
      ...(rawHex ? {} : {}),
    };
  }

  private decodeFirmwareVersion(byte: number): string {
    const major = (byte >> 6) & 0b11;
    const sub = (byte >> 4) & 0b11;
    const patch = byte & 0b1111;
    return `V${major}.${sub}.${patch}`;
  }

  private parseLocationFixed(payload: Buffer, _rawHex: string): Lw001BgProLocationFixedPayload {
    const header = this.decodeCommonHeader(payload);
    const after = payload.subarray(COMMON_HEADER_BYTES);
    if (after.length < 1 + 7 + 1 + 1) {
      throw new RangeError('location fixed payload too short');
    }
    const positioningTypeByte = after.readUInt8(0);
    const positioningType: Lw001BgProPositioningSuccessType =
      POSITIONING_SUCCESS_TYPE_MAP[positioningTypeByte] ?? 'unknown';
    const timestamp = this.decodeTimestamp7(after.subarray(1, 8));
    const tz = this.decodeSignedByte(after.readUInt8(8));
    const dataLength = after.readUInt8(9);
    const data = after.subarray(10, 10 + dataLength);

    let dataDecoded: Lw001BgProLocationFixedPayload['data'];
    if (positioningType === 'wifi' || positioningType === 'bluetooth') {
      dataDecoded = {
        positioningType: positioningType,
        devices: this.decodeMacRssiList(data),
      } as Lw001BgProLocationFixedPayload['data'];
    } else if (positioningType === 'gps') {
      dataDecoded = this.decodeGpsLocationData(data);
    } else {
      dataDecoded = { positioningType: 'unknown', raw: toHexString(data) };
    }

    return {
      ok: true,
      fPort: LW001_BG_PRO_UPLINK_PORTS.LOCATION_FIXED,
      type: 'location_fixed',
      header,
      positioningType,
      timestamp,
      timeZone: tz,
      data: dataDecoded,
    };
  }

  private parseLocationFailure(payload: Buffer, _rawHex: string): Lw001BgProLocationFailurePayload {
    const header = this.decodeCommonHeader(payload);
    const after = payload.subarray(COMMON_HEADER_BYTES);
    const reasonCode = after.readUInt8(0);
    const reason = LOCATION_FAILURE_REASON_MAP[reasonCode] ?? 'unknown';
    const len = after.readUInt8(1);
    const data = after.subarray(2, 2 + len);
    return {
      ok: true,
      fPort: LW001_BG_PRO_UPLINK_PORTS.LOCATION_FAILURE,
      type: 'location_failure',
      header,
      reasonCode,
      reason,
      failureData: { raw: toHexString(data) },
    };
  }

  private parseShutdown(payload: Buffer, _rawHex: string): Lw001BgProShutdownPayload {
    const header = this.decodeCommonHeader(payload);
    const shutdownByte = payload.readUInt8(COMMON_HEADER_BYTES);
    return {
      ok: true,
      fPort: LW001_BG_PRO_UPLINK_PORTS.SHUTDOWN,
      type: 'shutdown',
      header,
      shutdownType: SHUTDOWN_TYPE_MAP[shutdownByte] ?? 'lora_cmd',
    };
  }

  private parseShock(payload: Buffer, _rawHex: string): Lw001BgProShockPayload {
    const header = this.decodeCommonHeader(payload);
    const numberOfShocks = payload.readUInt16BE(COMMON_HEADER_BYTES);
    return {
      ok: true,
      fPort: LW001_BG_PRO_UPLINK_PORTS.SHOCK,
      type: 'shock',
      header,
      numberOfShocks,
    };
  }

  private parseManDown(payload: Buffer, _rawHex: string): Lw001BgProManDownPayload {
    const header = this.decodeCommonHeader(payload);
    const totalIdleTimeH = payload.readUInt16BE(COMMON_HEADER_BYTES);
    return {
      ok: true,
      fPort: LW001_BG_PRO_UPLINK_PORTS.MAN_DOWN,
      type: 'man_down',
      header,
      totalIdleTimeH,
    };
  }

  private parseTamperAlarm(payload: Buffer, _rawHex: string): Lw001BgProTamperAlarmPayload {
    const header = this.decodeCommonHeader(payload);
    const after = payload.subarray(COMMON_HEADER_BYTES);
    if (after.length < 8) {
      throw new RangeError('tamper alarm payload too short');
    }
    const timestamp = this.decodeTimestamp7(after.subarray(0, 7));
    const tz = this.decodeSignedByte(after.readUInt8(7));
    return {
      ok: true,
      fPort: LW001_BG_PRO_UPLINK_PORTS.TAMPER_ALARM,
      type: 'tamper_alarm',
      header,
      timestamp,
      timeZone: tz,
    };
  }

  private parseEventMessage(payload: Buffer, _rawHex: string): Lw001BgProEventMessagePayload {
    const header = this.decodeCommonHeader(payload);
    const eventCode = payload.readUInt8(COMMON_HEADER_BYTES);
    const eventType = EVENT_TYPE_MAP[eventCode];
    if (!eventType) {
      throw new RangeError(`unknown event type code: ${eventCode}`);
    }
    return {
      ok: true,
      fPort: LW001_BG_PRO_UPLINK_PORTS.EVENT_MESSAGE,
      type: 'event_message',
      header,
      eventType,
      eventCode,
    };
  }

  private parseBatteryConsumption(
    payload: Buffer,
    _rawHex: string,
  ): Lw001BgProBatteryConsumptionPayload {
    const header = this.decodeCommonHeader(payload);
    const after = payload.subarray(COMMON_HEADER_BYTES);
    if (after.length < 4 * 5) {
      throw new RangeError('battery consumption payload too short');
    }
    return {
      ok: true,
      fPort: LW001_BG_PRO_UPLINK_PORTS.BATTERY_CONSUMPTION,
      type: 'battery_consumption',
      header,
      gpsTimeS: after.readUInt32BE(0),
      wifiTimeS: after.readUInt32BE(4),
      btScanTimeS: after.readUInt32BE(8),
      btBroadcastTimeS: after.readUInt32BE(12),
      loraTimeS: after.readUInt32BE(16),
    };
  }

  /**
   * Port 10 — respuesta a CMD `Read parameters`.
   *
   * Estructura: `[3 bytes common header][TLV (Length+ID+Value) repetido]`.
   *
   * Si los bytes después del header no encajan como TLV válido, el resultado se reporta como
   * `read_response` con `parameters: []` (no se descarta el uplink) para que quede registro
   * trazable en el log/auditoría. El `MqttService` solo dispara verificación cuando hay al
   * menos un parámetro extraído.
   */
  private parseReadResponse(payload: Buffer, rawHex: string): Lw001BgProReadResponsePayload {
    const header = this.decodeCommonHeader(payload);
    const after = payload.subarray(COMMON_HEADER_BYTES);
    const parsedParams = this.tryParseReadResponse(after);
    return {
      ok: true,
      fPort: LW001_BG_PRO_UPLINK_PORTS.GENERAL_COMMANDS_RESPONSE,
      type: 'read_response',
      header,
      parameters: parsedParams ?? [],
      rawHex,
    };
  }

  private parseGpsLimit(payload: Buffer, _rawHex: string): Lw001BgProGpsLimitPayload {
    if (payload.length < 11) {
      throw new RangeError('gps limit payload too short');
    }
    const deviceStatusByte = payload.readUInt8(0);
    const ackBatteryByte = payload.readUInt8(1);
    const latitude = this.decodeLatLng(payload.readInt32BE(2));
    const longitude = this.decodeLatLng(payload.readInt32BE(6));
    const pdop = payload.readUInt8(10) / 10;
    return {
      ok: true,
      fPort: LW001_BG_PRO_UPLINK_PORTS.GPS_LIMIT,
      type: 'gps_limit',
      deviceStatusByte,
      ackBatteryByte,
      ack: ackBatteryByte & 0x0f,
      batteryVoltageV: this.decodeBatteryVoltage((ackBatteryByte >> 4) & 0x0f),
      latitude,
      longitude,
      pdop,
    };
  }

  private parseUnknown(fPort: number, payload: Buffer, rawHex: string): Lw001BgProUnknownPayload {
    const header = payload.length >= 3 ? this.decodeCommonHeader(payload) : null;
    return {
      ok: true,
      fPort,
      type: 'unknown',
      header,
      rawHex,
    };
  }

  // ============================================================
  // Sub-helpers
  // ============================================================

  private decodeSignedByte(byte: number): number {
    return byte > 128 ? byte - 256 : byte;
  }

  /**
   * 7 bytes timestamp BCD: year(2) month(1) date(1) hour(1) minute(1) second(1).
   * El timezone se aplica fuera; aquí construimos como UTC para no doble-aplicar.
   */
  private decodeTimestamp7(buffer: Buffer): Date {
    if (buffer.length < 7) {
      throw new RangeError('timestamp buffer too short');
    }
    const year = buffer.readUInt16BE(0);
    const month = buffer.readUInt8(2);
    const day = buffer.readUInt8(3);
    const hour = buffer.readUInt8(4);
    const minute = buffer.readUInt8(5);
    const second = buffer.readUInt8(6);
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  }

  private decodeLatLng(int32: number): number {
    // El número ya es signed (Int32BE). PDF dice "if value > 0x80000000, minus 0x100000000".
    // Como Buffer.readInt32BE ya hace ese ajuste, basta dividir entre 1e7.
    return int32 / 1e7;
  }

  private decodeMacRssiList(buffer: Buffer): Array<{ mac: string; rssi: number }> {
    const list: Array<{ mac: string; rssi: number }> = [];
    let offset = 0;
    while (offset + 7 <= buffer.length) {
      const mac = Array.from(buffer.subarray(offset, offset + 6))
        .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
        .join(':');
      const rssiByte = buffer.readUInt8(offset + 6);
      list.push({ mac, rssi: rssiByte - 256 });
      offset += 7;
    }
    return list;
  }

  private decodeGpsLocationData(buffer: Buffer): {
    positioningType: 'gps';
    latitude: number;
    longitude: number;
    pdop: number;
  } {
    if (buffer.length < 9) {
      throw new RangeError('gps location data too short');
    }
    return {
      positioningType: 'gps',
      latitude: this.decodeLatLng(buffer.readInt32BE(0)),
      longitude: this.decodeLatLng(buffer.readInt32BE(4)),
      pdop: buffer.readUInt8(8) / 10,
    };
  }
}
