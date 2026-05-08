import { Injectable } from '@nestjs/common';
import {
  LW001_BG_PRO_CMD,
  LW001_BG_PRO_CONTROL_COMMANDS,
  LW001_BG_PRO_LOCAL_STORAGE_COMMANDS,
  LW001_BG_PRO_PARAM_IDS,
} from './lw001-bg-pro.constants';
import {
  Lw001BgProBtScanningType,
  Lw001BgProControlCommand,
  Lw001BgProDefaultPowerStatus,
  Lw001BgProFixMode,
  Lw001BgProGpsModel,
  Lw001BgProLedIndicatorSetting,
  Lw001BgProLocalStorageInput,
  Lw001BgProLorawanMode,
  Lw001BgProLowPowerSetting,
  Lw001BgProMessageType,
  Lw001BgProMotionModeSettings,
  Lw001BgProPositioningStrategy,
  Lw001BgProRegion,
  Lw001BgProWorkingMode,
} from './lw001-bg-pro.types';

const RANGE = (min: number, max: number) => ({ min, max });

const RANGES = {
  TIME_ZONE: RANGE(-12, 12),
  HEARTBEAT_INTERVAL_S: RANGE(300, 86_400),
  /** PDF v1.2 indica 30..86400. Validador físico, validador de negocio aplica >=300 fuera del codec. */
  PERIODIC_REPORT_INTERVAL_S: RANGE(30, 86_400),
  MOTION_REPORT_INTERVAL_IN_TRIP_S: RANGE(10, 86_400),
  REPORT_INTERVAL_ON_TRIP_END_S: RANGE(10, 300),
  TRIP_END_TIMEOUT_UNITS_OF_10S: RANGE(3, 180),
  GPS_TIME_BUDGET_S: RANGE(0, 76_200),
  TIME_SYNC_INTERVAL_H: RANGE(0, 255),
  RECONNECT_INTERVAL_DAYS: RANGE(0, 30),
  WIFI_FIX_TIMEOUT_UNITS_OF_2S: RANGE(1, 5),
  NUMBER_OF_WIFI_BSSID: RANGE(1, 5),
  BLUETOOTH_FIX_TIMEOUT_S: RANGE(1, 10),
  NUMBER_OF_BT_DEVICES_IN_BLE_FIX: RANGE(1, 5),
  COARSE_ACCURACY_MASK_M: RANGE(5, 100),
  FINE_ACCURACY_MASK_M: RANGE(5, 100),
  COARSE_TIMEOUT_S: RANGE(1, 7_620),
  FINE_TIMEOUT_S: RANGE(0, 76_200),
  PDOP_LIMIT_DECI: RANGE(25, 100),
  AIDING_ACCURACY_M: RANGE(5, 1_000),
  AIDING_TIMEOUT_S: RANGE(1, 7_620),
  ADV_INTERVAL_BEACON_UNITS_OF_100MS: RANGE(1, 100),
  BT_CONFIG_BROADCAST_TIMEOUT_MIN: RANGE(1, 60),
  BT_MEASURED_POWER_DBM: RANGE(-127, 0),
  RSSI_FILTER_DBM: RANGE(-127, 0),
  ACCEL_WAKEUP_THRESHOLD_UNITS_OF_16MG: RANGE(1, 20),
  ACCEL_WAKEUP_DURATION_UNITS_OF_10MS: RANGE(1, 10),
  ACCEL_MOTION_THRESHOLD_UNITS_OF_2MG: RANGE(10, 250),
  ACCEL_MOTION_DURATION_UNITS_OF_5MS: RANGE(1, 50),
  SHOCK_THRESHOLD_UNITS_OF_10MG: RANGE(10, 255),
  SHOCK_REPORT_INTERVAL_S: RANGE(3, 255),
  SHOCK_TIMEOUT_S: RANGE(1, 20),
  IDLE_DETECTION_TIMEOUT_H: RANGE(1, 8_760),
  ACTIVE_STATE_TIMEOUT_S: RANGE(1, 86_400),
  NUMBER_OF_FIX_ON_TRIP_STARTEND: RANGE(1, 255),
  TIMING_REPORT_POINTS_COUNT: RANGE(1, 10),
  /** unidad 15 minutos: 1..96 representa 00:15..24:00 */
  TIMING_REPORT_POINT_UNITS_OF_15MIN: RANGE(1, 96),
  LOCAL_STORAGE_LAST_DAYS: RANGE(1, 65_535),
  MAJOR_MINOR_BEACON: RANGE(0, 65_535),
  ADV_NAME_LENGTH_BYTES: RANGE(1, 14),
  LOGIN_PASSWORD_LENGTH_BYTES: RANGE(8, 8),
};

const BT_TX_POWER_VALID = new Set([-40, -20, -16, -12, -8, -4, 0, 2, 3, 4, 5, 6, 7, 8]);

const REGION_MAP: Record<Lw001BgProRegion, number> = {
  as923: 0x00,
  au915: 0x01,
  cn470: 0x02,
  cn779: 0x03,
  eu443: 0x04,
  eu868: 0x05,
  kr920: 0x06,
  in865: 0x07,
  us915: 0x08,
  ru864: 0x09,
};

const GPS_MODEL_MAP: Record<Lw001BgProGpsModel, number> = {
  portable: 0x00,
  stationary: 0x01,
  pedestrian: 0x02,
  automotive: 0x03,
  at_sea: 0x04,
  airborne_lt_1g: 0x05,
  airborne_lt_2g: 0x06,
  airborne_lt_3g: 0x07,
  wrist: 0x08,
  bike: 0x09,
};

/**
 * Codec puro para LW001-BG PRO.
 *
 * - Construye buffers HEX exactos según el PDF v1.2.
 * - Valida rangos antes de construir.
 * - No conoce ChirpStack, ni TypeORM, ni HTTP.
 *
 * Las funciones que aplican a parámetros marcados como peligrosos en
 * `LW001_BG_PRO_DANGEROUS_PARAM_IDS` igualmente existen aquí, pero los
 * endpoints REST deben rechazarlas. Las claves criptográficas
 * (APPKEY, APPSKEY, NWKSKEY) NO tienen builder de configure por seguridad.
 */
@Injectable()
export class Lw001BgProDownlinkCodecService {
  // ============================================================
  // Helpers
  // ============================================================

  /** HEX en mayúsculas con espacios cada byte: "02 02 06 02". */
  toHex(buffer: Buffer): string {
    return buffer.toString('hex').toUpperCase().match(/.{1,2}/g)?.join(' ') ?? '';
  }

  toBase64(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  /** Concatena `02 + Length1+ID1+Value1 + Length2+ID2+Value2 + ...` a partir de los blocks
   * que retornan los métodos buildConfigure*. */
  buildConfigureMultiple(parts: Buffer[]): Buffer {
    if (parts.length === 0) {
      throw new RangeError('buildConfigureMultiple requires at least one part');
    }
    const blocks: Buffer[] = [Buffer.of(LW001_BG_PRO_CMD.CONFIGURE)];
    for (const part of parts) {
      // Cada `part` ya viene con [CMD=02, Length, ID, ...Value]. Extraemos a partir del Length.
      if (part.length < 3 || part[0] !== LW001_BG_PRO_CMD.CONFIGURE) {
        throw new TypeError(
          'buildConfigureMultiple expects buffers produced by buildConfigure* helpers',
        );
      }
      blocks.push(part.subarray(1));
    }
    return Buffer.concat(blocks);
  }

  // ============================================================
  // Control commands (CMD = 0x00, fPort 10)
  // ============================================================

  buildControlCommand(command: Lw001BgProControlCommand): Buffer {
    const code = this.controlCommandToCode(command);
    return Buffer.of(LW001_BG_PRO_CMD.CONTROL, code);
  }

  private controlCommandToCode(command: Lw001BgProControlCommand): number {
    switch (command) {
      case 'reboot':
        return LW001_BG_PRO_CONTROL_COMMANDS.REBOOT;
      case 'downlink_position':
        return LW001_BG_PRO_CONTROL_COMMANDS.DOWNLINK_FOR_POSITION;
      case 'enable_bluetooth':
        return LW001_BG_PRO_CONTROL_COMMANDS.ENABLE_BLUETOOTH_BROADCAST;
      case 'clear_man_down':
        return LW001_BG_PRO_CONTROL_COMMANDS.CLEAR_MAN_DOWN;
      case 'request_battery':
        return LW001_BG_PRO_CONTROL_COMMANDS.REQUEST_BATTERY_CONSUMPTION;
      case 'factory_reset':
        return LW001_BG_PRO_CONTROL_COMMANDS.FACTORY_RESET;
      default:
        throw new TypeError(`unknown control command: ${String(command)}`);
    }
  }

  // ============================================================
  // Read parameters (CMD = 0x01, fPort 10)
  // ============================================================

  buildReadParameters(ids: number[]): Buffer {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new RangeError('buildReadParameters requires at least one parameter id');
    }
    for (const id of ids) {
      if (!Number.isInteger(id) || id < 0 || id > 0xff) {
        throw new RangeError(`parameter id out of byte range: ${id}`);
      }
    }
    return Buffer.from([LW001_BG_PRO_CMD.READ, ...ids]);
  }

  // ============================================================
  // Configure helpers (CMD = 0x02, fPort 10) — uno por parámetro
  // ============================================================

  /** Construye `[02, Length, ID, ...Value]`. Length = 1 + value.length. */
  private buildConfigureBlock(id: number, value: Buffer): Buffer {
    const length = 1 + value.length; // ID + Value
    if (length > 0xff) {
      throw new RangeError(`configure block too long for id 0x${id.toString(16)}`);
    }
    return Buffer.concat([Buffer.of(LW001_BG_PRO_CMD.CONFIGURE, length, id), value]);
  }

  private writeUInt8(value: number): Buffer {
    return Buffer.of(value & 0xff);
  }

  private writeBigEndianUInt(value: number, byteLength: 1 | 2 | 3 | 4): Buffer {
    const buffer = Buffer.alloc(byteLength);
    buffer.writeUIntBE(value, 0, byteLength);
    return buffer;
  }

  private assertRange(label: string, value: number, range: { min: number; max: number }): void {
    if (!Number.isInteger(value) || value < range.min || value > range.max) {
      throw new RangeError(`${label} out of range [${range.min}..${range.max}], got ${value}`);
    }
  }

  private positioningStrategyToByte(strategy: Lw001BgProPositioningStrategy): number {
    return (
      (strategy.wifi ? 0b001 : 0) |
      (strategy.bluetooth ? 0b010 : 0) |
      (strategy.gps ? 0b100 : 0)
    );
  }

  // ---------- 6.1 Generales ----------

  buildConfigureTimeZone(utcOffsetHours: number): Buffer {
    this.assertRange('timeZone (UTC offset)', utcOffsetHours, RANGES.TIME_ZONE);
    // Signed byte: si negativo, 256 + value.
    const byte = utcOffsetHours < 0 ? 256 + utcOffsetHours : utcOffsetHours;
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.TIME_ZONE, this.writeUInt8(byte));
  }

  /**
   * @internal Solo se invoca desde scripts internos con flag INTERNAL_ALLOW_KEY_CHANGE=true.
   */
  buildConfigureLoginPassword(passwordAscii: string): Buffer {
    if (typeof passwordAscii !== 'string') {
      throw new TypeError('loginPassword must be string');
    }
    const buffer = Buffer.from(passwordAscii, 'ascii');
    this.assertRange('loginPassword length', buffer.length, RANGES.LOGIN_PASSWORD_LENGTH_BYTES);
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.LOGIN_PASSWORD, buffer);
  }

  buildConfigureWorkingMode(mode: Lw001BgProWorkingMode): Buffer {
    const map: Record<Lw001BgProWorkingMode, number> = {
      standby: 0x01,
      periodic: 0x02,
      timing: 0x03,
      motion: 0x04,
    };
    const value = map[mode];
    if (value === undefined) {
      throw new TypeError(`invalid working mode: ${String(mode)}`);
    }
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.WORKING_MODE, this.writeUInt8(value));
  }

  buildConfigureDefaultPowerStatus(status: Lw001BgProDefaultPowerStatus): Buffer {
    const map: Record<Lw001BgProDefaultPowerStatus, number> = {
      off: 0x00,
      revert_to_last: 0x01,
    };
    const value = map[status];
    if (value === undefined) {
      throw new TypeError(`invalid default power status: ${String(status)}`);
    }
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.DEFAULT_POWER_STATUS,
      this.writeUInt8(value),
    );
  }

  buildConfigureHeartbeatInterval(seconds: number): Buffer {
    this.assertRange('heartbeatInterval', seconds, RANGES.HEARTBEAT_INTERVAL_S);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.HEARTBEAT_INTERVAL,
      this.writeBigEndianUInt(seconds, 4),
    );
  }

  buildConfigureOffByMagnetSwitch(enabled: boolean): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.OFF_BY_MAGNET_SWITCH,
      this.writeUInt8(enabled ? 1 : 0),
    );
  }

  buildConfigureShutdownPayloadSwitch(enabled: boolean): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.SHUTDOWN_PAYLOAD_SWITCH,
      this.writeUInt8(enabled ? 1 : 0),
    );
  }

  buildConfigureOfflineFixSwitch(enabled: boolean): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.OFFLINE_FIX_SWITCH,
      this.writeUInt8(enabled ? 1 : 0),
    );
  }

  buildConfigureLowPowerSetting(setting: Lw001BgProLowPowerSetting): Buffer {
    const byte = (setting.promptAt10Percent ? 0b01 : 0) | (setting.sendLowPowerPayload ? 0b10 : 0);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.LOW_POWER_SETTING,
      this.writeUInt8(byte),
    );
  }

  buildConfigureLedIndicatorSetting(setting: Lw001BgProLedIndicatorSetting): Buffer {
    const bits = [
      setting.tamperAlarm,
      setting.lowPower,
      setting.inBluetoothFix,
      setting.bluetoothFixSuccess,
      setting.bluetoothFixFailed,
      setting.inGpsFix,
      setting.gpsFixSuccess,
      setting.gpsFixFailed,
      setting.inWifiFix,
      setting.wifiFixSuccess,
      setting.wifiFixFailed,
    ];
    const value = bits.reduce<number>((acc, bit, idx) => (bit ? acc | (1 << idx) : acc), 0);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.LED_INDICATOR_SETTING,
      this.writeBigEndianUInt(value, 2),
    );
  }

  // ---------- 6.2 Periodic ----------

  buildConfigurePeriodicPositioningStrategy(strategy: Lw001BgProPositioningStrategy): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.PERIODIC_POSITIONING_STRATEGY,
      this.writeUInt8(this.positioningStrategyToByte(strategy)),
    );
  }

  buildConfigurePeriodicReportInterval(seconds: number): Buffer {
    this.assertRange('periodicReportInterval', seconds, RANGES.PERIODIC_REPORT_INTERVAL_S);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.PERIODIC_REPORT_INTERVAL,
      this.writeBigEndianUInt(seconds, 4),
    );
  }

  // ---------- 6.3 Timing ----------

  buildConfigureTimingPositioningStrategy(strategy: Lw001BgProPositioningStrategy): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.TIMING_POSITIONING_STRATEGY,
      this.writeUInt8(this.positioningStrategyToByte(strategy)),
    );
  }

  /** Cada punto en unidades de 15 min: 1=00:15, 2=00:30 ... 96=24:00. Hasta 10. */
  buildConfigureTimingReportPoints(pointsUnitsOf15Min: number[]): Buffer {
    this.assertRange('timing report points count', pointsUnitsOf15Min.length, RANGES.TIMING_REPORT_POINTS_COUNT);
    for (const p of pointsUnitsOf15Min) {
      this.assertRange('timing report point', p, RANGES.TIMING_REPORT_POINT_UNITS_OF_15MIN);
    }
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.TIMING_REPORT_POINTS,
      Buffer.from(pointsUnitsOf15Min),
    );
  }

  // ---------- 6.4 Motion ----------

  buildConfigureMotionModeSettings(settings: Lw001BgProMotionModeSettings): Buffer {
    const value =
      (settings.notifyEventOnStart ? 1 << 0 : 0) |
      (settings.fixOnStart ? 1 << 1 : 0) |
      (settings.notifyEventInTrip ? 1 << 2 : 0) |
      (settings.fixInTrip ? 1 << 3 : 0) |
      (settings.notifyEventOnEnd ? 1 << 4 : 0) |
      (settings.fixOnEnd ? 1 << 5 : 0);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.MOTION_MODE_SETTING,
      this.writeUInt8(value),
    );
  }

  buildConfigureNumberOfFixOnTripStart(count: number): Buffer {
    this.assertRange('numberOfFixOnTripStart', count, RANGES.NUMBER_OF_FIX_ON_TRIP_STARTEND);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.MOTION_NUMBER_OF_FIX_ON_TRIP_START,
      this.writeUInt8(count),
    );
  }

  buildConfigureMotionPositioningStrategyOnTripStart(strategy: Lw001BgProPositioningStrategy): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.MOTION_POSITION_STRATEGY_ON_TRIP_START,
      this.writeUInt8(this.positioningStrategyToByte(strategy)),
    );
  }

  buildConfigureMotionReportIntervalInTrip(seconds: number): Buffer {
    this.assertRange('motionReportIntervalInTrip', seconds, RANGES.MOTION_REPORT_INTERVAL_IN_TRIP_S);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.MOTION_REPORT_INTERVAL_IN_TRIP,
      this.writeBigEndianUInt(seconds, 4),
    );
  }

  buildConfigureMotionPositioningStrategyInTrip(strategy: Lw001BgProPositioningStrategy): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.MOTION_POSITION_STRATEGY_IN_TRIP,
      this.writeUInt8(this.positioningStrategyToByte(strategy)),
    );
  }

  buildConfigureTripEndTimeout(unitsOf10Seconds: number): Buffer {
    this.assertRange('tripEndTimeout (10s units)', unitsOf10Seconds, RANGES.TRIP_END_TIMEOUT_UNITS_OF_10S);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.MOTION_TRIP_END_TIMEOUT,
      this.writeUInt8(unitsOf10Seconds),
    );
  }

  buildConfigureNumberOfFixOnTripEnd(count: number): Buffer {
    this.assertRange('numberOfFixOnTripEnd', count, RANGES.NUMBER_OF_FIX_ON_TRIP_STARTEND);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.MOTION_NUMBER_OF_FIX_ON_TRIP_END,
      this.writeUInt8(count),
    );
  }

  buildConfigureReportIntervalOnTripEnd(seconds: number): Buffer {
    this.assertRange('reportIntervalOnTripEnd', seconds, RANGES.REPORT_INTERVAL_ON_TRIP_END_S);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.MOTION_REPORT_INTERVAL_ON_TRIP_END,
      this.writeBigEndianUInt(seconds, 2),
    );
  }

  buildConfigureMotionPositioningStrategyOnTripEnd(strategy: Lw001BgProPositioningStrategy): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.MOTION_POSITION_STRATEGY_ON_TRIP_END,
      this.writeUInt8(this.positioningStrategyToByte(strategy)),
    );
  }

  // ---------- 6.5 Downlink for Position ----------

  buildConfigureDownlinkForPositionStrategy(strategy: Lw001BgProPositioningStrategy): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.DOWNLINK_FOR_POSITION_STRATEGY,
      this.writeUInt8(this.positioningStrategyToByte(strategy)),
    );
  }

  // ---------- 6.6 WiFi/BT tuning ----------

  buildConfigureWifiFixTimeout(unitsOf2Seconds: number): Buffer {
    this.assertRange('wifiFixTimeout (2s units)', unitsOf2Seconds, RANGES.WIFI_FIX_TIMEOUT_UNITS_OF_2S);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.WIFI_FIX_TIMEOUT,
      this.writeUInt8(unitsOf2Seconds),
    );
  }

  buildConfigureNumberOfWifiBssid(count: number): Buffer {
    this.assertRange('numberOfWifiBssid', count, RANGES.NUMBER_OF_WIFI_BSSID);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.NUMBER_OF_WIFI_BSSID,
      this.writeUInt8(count),
    );
  }

  buildConfigureBluetoothFixTimeout(seconds: number): Buffer {
    this.assertRange('bluetoothFixTimeout', seconds, RANGES.BLUETOOTH_FIX_TIMEOUT_S);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.BLUETOOTH_FIX_TIMEOUT,
      this.writeUInt8(seconds),
    );
  }

  buildConfigureNumberOfBtDevicesInBleFix(count: number): Buffer {
    this.assertRange('numberOfBtDevicesInBleFix', count, RANGES.NUMBER_OF_BT_DEVICES_IN_BLE_FIX);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.NUMBER_OF_BT_DEVICES_IN_BLE_FIX,
      this.writeUInt8(count),
    );
  }

  // ---------- 6.7 Filter Conditions A/B ----------

  buildConfigureFilterAbRelation(relation: 'or' | 'and'): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.FILTER_AB_RELATION,
      this.writeUInt8(relation === 'and' ? 1 : 0),
    );
  }

  buildConfigureFilterSwitch(filter: 'A' | 'B', enabled: boolean): Buffer {
    const id = filter === 'A' ? LW001_BG_PRO_PARAM_IDS.FILTER_A_SWITCH : LW001_BG_PRO_PARAM_IDS.FILTER_B_SWITCH;
    return this.buildConfigureBlock(id, this.writeUInt8(enabled ? 1 : 0));
  }

  buildConfigureFilterRssi(filter: 'A' | 'B', rssiDbm: number): Buffer {
    this.assertRange('filterRssi', rssiDbm, RANGES.RSSI_FILTER_DBM);
    const byte = rssiDbm < 0 ? 256 + rssiDbm : rssiDbm;
    const id = filter === 'A' ? LW001_BG_PRO_PARAM_IDS.FILTER_A_RSSI : LW001_BG_PRO_PARAM_IDS.FILTER_B_RSSI;
    return this.buildConfigureBlock(id, this.writeUInt8(byte));
  }

  // (los demás filtros — ADV name, MAC, Major, Minor, raw, UUID — pueden agregarse según necesidad real)

  // ---------- 6.8 GPS avanzado ----------

  buildConfigureCoarseAccuracyMask(meters: number): Buffer {
    this.assertRange('coarseAccuracyMask (m)', meters, RANGES.COARSE_ACCURACY_MASK_M);
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.COARSE_ACCURACY_MASK, this.writeUInt8(meters));
  }

  buildConfigureFineAccuracyMask(meters: number): Buffer {
    this.assertRange('fineAccuracyMask (m)', meters, RANGES.FINE_ACCURACY_MASK_M);
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.FINE_ACCURACY_MASK, this.writeUInt8(meters));
  }

  buildConfigureCoarseTimeout(seconds: number): Buffer {
    this.assertRange('coarseTimeout (s)', seconds, RANGES.COARSE_TIMEOUT_S);
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.COARSE_TIMEOUT, this.writeBigEndianUInt(seconds, 2));
  }

  buildConfigureFineTimeout(seconds: number): Buffer {
    this.assertRange('fineTimeout (s)', seconds, RANGES.FINE_TIMEOUT_S);
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.FINE_TIMEOUT, this.writeBigEndianUInt(seconds, 2));
  }

  buildConfigurePdopLimit(deciValue: number): Buffer {
    this.assertRange('pdopLimit (deci)', deciValue, RANGES.PDOP_LIMIT_DECI);
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.PDOP_LIMIT, this.writeUInt8(deciValue));
  }

  buildConfigureFixMode(mode: Lw001BgProFixMode): Buffer {
    const map: Record<Lw001BgProFixMode, number> = { '2d': 0x00, '3d': 0x01, auto: 0x02 };
    const value = map[mode];
    if (value === undefined) {
      throw new TypeError(`invalid fix mode: ${String(mode)}`);
    }
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.FIX_MODE, this.writeUInt8(value));
  }

  buildConfigureGpsModel(model: Lw001BgProGpsModel): Buffer {
    const value = GPS_MODEL_MAP[model];
    if (value === undefined) {
      throw new TypeError(`invalid GPS model: ${String(model)}`);
    }
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.GPS_MODEL, this.writeUInt8(value));
  }

  buildConfigureGpsTimeBudget(seconds: number): Buffer {
    this.assertRange('gpsTimeBudget (s)', seconds, RANGES.GPS_TIME_BUDGET_S);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.GPS_TIME_BUDGET,
      this.writeBigEndianUInt(seconds, 4),
    );
  }

  buildConfigureAutonomousAidingSwitch(enabled: boolean): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.AUTONOMOUS_AIDING_SWITCH,
      this.writeUInt8(enabled ? 1 : 0),
    );
  }

  buildConfigureAidingAccuracy(meters: number): Buffer {
    this.assertRange('aidingAccuracy (m)', meters, RANGES.AIDING_ACCURACY_M);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.AIDING_ACCURACY,
      this.writeBigEndianUInt(meters, 2),
    );
  }

  buildConfigureAidingTimeout(seconds: number): Buffer {
    this.assertRange('aidingTimeout (s)', seconds, RANGES.AIDING_TIMEOUT_S);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.AIDING_TIMEOUT,
      this.writeBigEndianUInt(seconds, 2),
    );
  }

  buildConfigureGpsExtremeModeSwitch(enabled: boolean): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.GPS_EXTREME_MODE_SWITCH,
      this.writeUInt8(enabled ? 1 : 0),
    );
  }

  // ---------- 6.9 LoRaWAN sensibles (no expuestos vía REST) ----------

  /** @internal */
  buildConfigureRegion(region: Lw001BgProRegion): Buffer {
    const value = REGION_MAP[region];
    if (value === undefined) {
      throw new TypeError(`invalid region: ${String(region)}`);
    }
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.REGION, this.writeUInt8(value));
  }

  /** @internal */
  buildConfigureLorawanMode(mode: Lw001BgProLorawanMode): Buffer {
    const value = mode === 'abp' ? 0x01 : mode === 'otaa' ? 0x02 : NaN;
    if (Number.isNaN(value)) {
      throw new TypeError(`invalid lorawan mode: ${String(mode)}`);
    }
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.LORAWAN_MODE, this.writeUInt8(value));
  }

  /** @internal */
  buildConfigureMessageType(messageType: Lw001BgProMessageType): Buffer {
    const value = messageType === 'unconfirmed' ? 0x00 : 0x01;
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.MESSAGE_TYPE, this.writeUInt8(value));
  }

  /**
   * @internal NUNCA exponer en REST. APPKEY / APPSKEY / NWKSKEY no tienen builders por seguridad.
   * DEVEUI / APPEUI sí pueden cambiarse en bench bajo flag explícito.
   */
  buildConfigureDevEui(eui8Bytes: Buffer): Buffer {
    if (eui8Bytes.length !== 8) {
      throw new RangeError('DEVEUI must be 8 bytes');
    }
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.DEVEUI, eui8Bytes);
  }

  /** @internal */
  buildConfigureAppEui(eui8Bytes: Buffer): Buffer {
    if (eui8Bytes.length !== 8) {
      throw new RangeError('APPEUI must be 8 bytes');
    }
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.APPEUI, eui8Bytes);
  }

  // ---------- 6.10 Tiempo ----------

  buildConfigureTimeSyncInterval(hours: number): Buffer {
    this.assertRange('timeSyncInterval (h)', hours, RANGES.TIME_SYNC_INTERVAL_H);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.TIME_SYNC_INTERVAL,
      this.writeUInt8(hours),
    );
  }

  buildConfigureReconnectInterval(days: number): Buffer {
    this.assertRange('reconnectInterval (days)', days, RANGES.RECONNECT_INTERVAL_DAYS);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.RECONNECT_INTERVAL,
      this.writeUInt8(days),
    );
  }

  // ---------- 6.11 Bluetooth beacon ----------

  buildConfigureBtBeaconModeSwitch(enabled: boolean): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.BT_BEACON_MODE_SWITCH,
      this.writeUInt8(enabled ? 1 : 0),
    );
  }

  buildConfigureBtAdvIntervalBeacon(unitsOf100Ms: number): Buffer {
    this.assertRange('btAdvIntervalBeacon (100ms units)', unitsOf100Ms, RANGES.ADV_INTERVAL_BEACON_UNITS_OF_100MS);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.BT_ADV_INTERVAL_BEACON,
      this.writeUInt8(unitsOf100Ms),
    );
  }

  buildConfigureBtConnectableState(connectable: boolean): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.BT_CONNECTABLE_STATE,
      this.writeUInt8(connectable ? 1 : 0),
    );
  }

  buildConfigureBtConfigBroadcastTimeout(minutes: number): Buffer {
    this.assertRange('btConfigBroadcastTimeout (min)', minutes, RANGES.BT_CONFIG_BROADCAST_TIMEOUT_MIN);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.BT_CONFIG_BROADCAST_TIMEOUT,
      this.writeUInt8(minutes),
    );
  }

  buildConfigureBtBeaconUuid(uuid16Bytes: Buffer): Buffer {
    if (uuid16Bytes.length !== 16) {
      throw new RangeError('BT beacon UUID must be 16 bytes');
    }
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.BT_BEACON_UUID, uuid16Bytes);
  }

  buildConfigureBtBeaconMajor(value: number): Buffer {
    this.assertRange('btBeaconMajor', value, RANGES.MAJOR_MINOR_BEACON);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.BT_BEACON_MAJOR,
      this.writeBigEndianUInt(value, 2),
    );
  }

  buildConfigureBtBeaconMinor(value: number): Buffer {
    this.assertRange('btBeaconMinor', value, RANGES.MAJOR_MINOR_BEACON);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.BT_BEACON_MINOR,
      this.writeBigEndianUInt(value, 2),
    );
  }

  buildConfigureBtMeasuredPower(rssiAt1mDbm: number): Buffer {
    this.assertRange('btMeasuredPower', rssiAt1mDbm, RANGES.BT_MEASURED_POWER_DBM);
    const byte = rssiAt1mDbm < 0 ? 256 + rssiAt1mDbm : rssiAt1mDbm;
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.BT_MEASURED_POWER, this.writeUInt8(byte));
  }

  buildConfigureBtTxPower(dbm: number): Buffer {
    if (!BT_TX_POWER_VALID.has(dbm)) {
      throw new RangeError(`btTxPower not in valid set: ${dbm}`);
    }
    const byte = dbm < 0 ? 256 + dbm : dbm;
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.BT_TX_POWER, this.writeUInt8(byte));
  }

  buildConfigureBtAdvName(name: string): Buffer {
    const buffer = Buffer.from(name, 'ascii');
    this.assertRange('btAdvName length', buffer.length, RANGES.ADV_NAME_LENGTH_BYTES);
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.BT_ADV_NAME, buffer);
  }

  buildConfigureBtScanningType(type: Lw001BgProBtScanningType): Buffer {
    const map: Record<Lw001BgProBtScanningType, number> = {
      ble4_1m_phy: 0x00,
      ble5_1m_phy: 0x01,
      ble5_coded_phy: 0x02,
      ble4_5_1m_phy: 0x03,
    };
    const value = map[type];
    if (value === undefined) {
      throw new TypeError(`invalid bt scanning type: ${String(type)}`);
    }
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.BT_SCANNING_TYPE, this.writeUInt8(value));
  }

  // ---------- 6.12 3-Axis y detecciones ----------

  buildConfigureAccelWakeup(thresholdUnitsOf16Mg: number, durationUnitsOf10Ms: number): Buffer {
    this.assertRange('accelWakeup threshold', thresholdUnitsOf16Mg, RANGES.ACCEL_WAKEUP_THRESHOLD_UNITS_OF_16MG);
    this.assertRange('accelWakeup duration', durationUnitsOf10Ms, RANGES.ACCEL_WAKEUP_DURATION_UNITS_OF_10MS);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.ACCEL_WAKEUP,
      Buffer.of(thresholdUnitsOf16Mg, durationUnitsOf10Ms),
    );
  }

  buildConfigureAccelMotion(thresholdUnitsOf2Mg: number, durationUnitsOf5Ms: number): Buffer {
    this.assertRange('accelMotion threshold', thresholdUnitsOf2Mg, RANGES.ACCEL_MOTION_THRESHOLD_UNITS_OF_2MG);
    this.assertRange('accelMotion duration', durationUnitsOf5Ms, RANGES.ACCEL_MOTION_DURATION_UNITS_OF_5MS);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.ACCEL_MOTION,
      Buffer.of(thresholdUnitsOf2Mg, durationUnitsOf5Ms),
    );
  }

  buildConfigureShockDetectionSwitch(enabled: boolean): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.SHOCK_DETECTION_SWITCH,
      this.writeUInt8(enabled ? 1 : 0),
    );
  }

  buildConfigureShockThreshold(unitsOf10Mg: number): Buffer {
    this.assertRange('shockThreshold (10mg units)', unitsOf10Mg, RANGES.SHOCK_THRESHOLD_UNITS_OF_10MG);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.SHOCK_THRESHOLD,
      this.writeUInt8(unitsOf10Mg),
    );
  }

  buildConfigureShockReportInterval(seconds: number): Buffer {
    this.assertRange('shockReportInterval (s)', seconds, RANGES.SHOCK_REPORT_INTERVAL_S);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.SHOCK_REPORT_INTERVAL,
      this.writeUInt8(seconds),
    );
  }

  buildConfigureShockTimeout(seconds: number): Buffer {
    this.assertRange('shockTimeout (s)', seconds, RANGES.SHOCK_TIMEOUT_S);
    return this.buildConfigureBlock(LW001_BG_PRO_PARAM_IDS.SHOCK_TIMEOUT, this.writeUInt8(seconds));
  }

  buildConfigureManDownDetectionSwitch(enabled: boolean): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.MAN_DOWN_DETECTION_SWITCH,
      this.writeUInt8(enabled ? 1 : 0),
    );
  }

  buildConfigureIdleDetectionTimeout(hours: number): Buffer {
    this.assertRange('idleDetectionTimeout (h)', hours, RANGES.IDLE_DETECTION_TIMEOUT_H);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.IDLE_DETECTION_TIMEOUT,
      this.writeBigEndianUInt(hours, 2),
    );
  }

  buildConfigureTamperAlarmSwitch(enabled: boolean): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.TAMPER_ALARM_SWITCH,
      this.writeUInt8(enabled ? 1 : 0),
    );
  }

  buildConfigureActiveStateCountSwitch(enabled: boolean): Buffer {
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.ACTIVE_STATE_COUNT_SWITCH,
      this.writeUInt8(enabled ? 1 : 0),
    );
  }

  buildConfigureActiveStateTimeout(seconds: number): Buffer {
    this.assertRange('activeStateTimeout (s)', seconds, RANGES.ACTIVE_STATE_TIMEOUT_S);
    return this.buildConfigureBlock(
      LW001_BG_PRO_PARAM_IDS.ACTIVE_STATE_TIMEOUT,
      this.writeBigEndianUInt(seconds, 4),
    );
  }

  // ============================================================
  // Local Storage Data Command (fPort 11)
  // ============================================================

  buildLocalStorageCommand(input: Lw001BgProLocalStorageInput): Buffer {
    if (input.action === 'upload') {
      this.assertRange('lastDays', input.lastDays, RANGES.LOCAL_STORAGE_LAST_DAYS);
      return Buffer.concat([
        this.writeUInt8(LW001_BG_PRO_LOCAL_STORAGE_COMMANDS.UPLOAD_LAST_DAYS),
        this.writeBigEndianUInt(input.lastDays, 2),
      ]);
    }
    if (input.action === 'clear') {
      return this.writeUInt8(LW001_BG_PRO_LOCAL_STORAGE_COMMANDS.CLEAR_ALL);
    }
    if (input.action === 'pause') {
      return this.writeUInt8(LW001_BG_PRO_LOCAL_STORAGE_COMMANDS.PAUSE_UPLOAD);
    }
    if (input.action === 'resume') {
      return this.writeUInt8(LW001_BG_PRO_LOCAL_STORAGE_COMMANDS.RESUME_UPLOAD);
    }
    throw new TypeError(`unknown local storage action: ${String((input as { action: string }).action)}`);
  }
}
