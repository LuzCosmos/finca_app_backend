/**
 * Tipos de dominio del codec / parser MOKO LW001-BG PRO.
 * No depende de NestJS para mantener el codec testeable como funciones puras.
 */

export type Lw001BgProControlCommand =
  | 'reboot'
  | 'downlink_position'
  | 'enable_bluetooth'
  | 'clear_man_down'
  | 'request_battery'
  | 'factory_reset';

export type Lw001BgProWorkingMode = 'standby' | 'periodic' | 'timing' | 'motion';

export type Lw001BgProDefaultPowerStatus = 'off' | 'revert_to_last';

export type Lw001BgProFixMode = '2d' | '3d' | 'auto';

export type Lw001BgProGpsModel =
  | 'portable'
  | 'stationary'
  | 'pedestrian'
  | 'automotive'
  | 'at_sea'
  | 'airborne_lt_1g'
  | 'airborne_lt_2g'
  | 'airborne_lt_3g'
  | 'wrist'
  | 'bike';

export type Lw001BgProRegion =
  | 'as923'
  | 'au915'
  | 'cn470'
  | 'cn779'
  | 'eu443'
  | 'eu868'
  | 'kr920'
  | 'in865'
  | 'us915'
  | 'ru864';

export type Lw001BgProLorawanMode = 'abp' | 'otaa';

export type Lw001BgProMessageType = 'unconfirmed' | 'confirmed';

export type Lw001BgProBtScanningType =
  | 'ble4_1m_phy'
  | 'ble5_1m_phy'
  | 'ble5_coded_phy'
  | 'ble4_5_1m_phy';

export type Lw001BgProShutdownType = 'ble_cmd' | 'lora_cmd' | 'magnet';

export type Lw001BgProEventType =
  | 'start_of_movement'
  | 'in_movement'
  | 'end_of_movement'
  | 'triggered_by_downlink';

export type Lw001BgProHeartbeatReason =
  | 'power_failure_restart'
  | 'ble_cmd'
  | 'lora_cmd'
  | 'normal_power_on'
  | 'unknown';

export type Lw001BgProPositioningSuccessType = 'wifi' | 'bluetooth' | 'gps' | 'unknown';

/** Bitmask Bit0=WiFi, Bit1=BT, Bit2=GPS. */
export interface Lw001BgProPositioningStrategy {
  wifi: boolean;
  bluetooth: boolean;
  gps: boolean;
}

/** Bitmask 6 bits del Motion Mode Setting (ID 0x24). */
export interface Lw001BgProMotionModeSettings {
  notifyEventOnStart: boolean;
  fixOnStart: boolean;
  notifyEventInTrip: boolean;
  fixInTrip: boolean;
  notifyEventOnEnd: boolean;
  fixOnEnd: boolean;
}

/** Bitmask 2 bits del Low Power Setting (ID 0x0C). */
export interface Lw001BgProLowPowerSetting {
  /** false = 5%, true = 10%. */
  promptAt10Percent: boolean;
  /** false = no enviar low power payload, true = enviar. */
  sendLowPowerPayload: boolean;
}

/** Bitmask 11 bits del LED Indicator Setting (ID 0x0D). */
export interface Lw001BgProLedIndicatorSetting {
  tamperAlarm: boolean;
  lowPower: boolean;
  inBluetoothFix: boolean;
  bluetoothFixSuccess: boolean;
  bluetoothFixFailed: boolean;
  inGpsFix: boolean;
  gpsFixSuccess: boolean;
  gpsFixFailed: boolean;
  inWifiFix: boolean;
  wifiFixSuccess: boolean;
  wifiFixFailed: boolean;
}

/** Sub-comando del Local Storage Data Command (Port 11). */
export type Lw001BgProLocalStorageAction = 'upload' | 'clear' | 'pause' | 'resume';

export interface Lw001BgProLocalStorageUploadInput {
  action: 'upload';
  /** 1..65535. 65535 (`0xFFFF`) significa "todo el almacenamiento". */
  lastDays: number;
}

export interface Lw001BgProLocalStorageSimpleInput {
  action: 'clear' | 'pause' | 'resume';
}

export type Lw001BgProLocalStorageInput =
  | Lw001BgProLocalStorageUploadInput
  | Lw001BgProLocalStorageSimpleInput;

// ============================================================
// Common header decoded
// ============================================================

export type Lw001BgProOperationMode = 'standby' | 'periodic' | 'timing' | 'motion';

export interface Lw001BgProCommonHeader {
  operationMode: Lw001BgProOperationMode;
  lowBattery: boolean;
  tamperTriggered: boolean;
  manDownIdle: boolean;
  motionSinceLast: boolean;
  /** Bit 6 — solo válido para Location Payload. */
  positioningTriggeredByDownlink: boolean;
  temperatureCelsius: number;
  /** ACK 0..15 (contador de downlinks recibidos). */
  ack: number;
  batteryVoltageV: number;
}

// ============================================================
// Uplink decoded payloads (uno por puerto)
// ============================================================

export interface Lw001BgProReadParameter {
  id: number;
  /** Nombre humano si está mapeado, sino undefined. */
  name?: string;
  length: number;
  /** Bytes crudos del valor. Acceso a interpretación específica via helpers. */
  value: Buffer;
  /** Hex legible — útil para logging/auditoría. */
  valueHex: string;
}

export interface Lw001BgProUplinkBase {
  ok: true;
  fPort: number;
  header: Lw001BgProCommonHeader | null;
  /** Si los bytes después del header parecen ser respuesta a Read parameters. */
  parameters?: Lw001BgProReadParameter[];
}

export interface Lw001BgProUplinkHeartbeat extends Lw001BgProUplinkBase {
  type: 'heartbeat';
  reason: Lw001BgProHeartbeatReason;
  /** "V<major>.<sub>.<patch>". */
  firmwareVersion: string;
  /** Big-endian u32. */
  activeStateCount: number;
}

export interface Lw001BgProLocationFixedPayload extends Lw001BgProUplinkBase {
  type: 'location_fixed';
  positioningType: Lw001BgProPositioningSuccessType;
  /** UTC date construida desde el timestamp BCD del payload + tz aplicado. */
  timestamp: Date;
  /** Time zone en horas (signed). */
  timeZone: number;
  data:
    | { positioningType: 'wifi'; devices: Array<{ mac: string; rssi: number }> }
    | { positioningType: 'bluetooth'; devices: Array<{ mac: string; rssi: number }> }
    | { positioningType: 'gps'; latitude: number; longitude: number; pdop: number }
    | { positioningType: 'unknown'; raw: string };
}

export interface Lw001BgProLocationFailurePayload extends Lw001BgProUplinkBase {
  type: 'location_failure';
  reasonCode: number;
  reason: string;
  failureData: {
    /** WiFi/BT scan results, GPS PDOP+CN0..3, o raw. */
    raw: string;
  };
}

export interface Lw001BgProShutdownPayload extends Lw001BgProUplinkBase {
  type: 'shutdown';
  shutdownType: Lw001BgProShutdownType;
}

export interface Lw001BgProShockPayload extends Lw001BgProUplinkBase {
  type: 'shock';
  numberOfShocks: number;
}

export interface Lw001BgProManDownPayload extends Lw001BgProUplinkBase {
  type: 'man_down';
  /** Total idle time en horas. */
  totalIdleTimeH: number;
}

export interface Lw001BgProTamperAlarmPayload extends Lw001BgProUplinkBase {
  type: 'tamper_alarm';
  timestamp: Date;
  timeZone: number;
}

export interface Lw001BgProEventMessagePayload extends Lw001BgProUplinkBase {
  type: 'event_message';
  eventType: Lw001BgProEventType;
  eventCode: number;
}

export interface Lw001BgProBatteryConsumptionPayload extends Lw001BgProUplinkBase {
  type: 'battery_consumption';
  gpsTimeS: number;
  wifiTimeS: number;
  btScanTimeS: number;
  btBroadcastTimeS: number;
  loraTimeS: number;
}

export interface Lw001BgProGpsLimitPayload {
  ok: true;
  fPort: 12;
  /** Port 12 NO tiene common header de 3 bytes — solo deviceStatus + ackBattery. */
  type: 'gps_limit';
  deviceStatusByte: number;
  ackBatteryByte: number;
  ack: number;
  batteryVoltageV: number;
  latitude: number;
  longitude: number;
  pdop: number;
}

/**
 * Respuesta a CMD `Read parameters` recibida en el mismo puerto que se usa para los
 * downlinks de comandos generales (fPort 10).
 *
 * Estructura: cabecera común (3 bytes) + secuencia TLV `Length+ID+Value` repetida.
 *
 * Se documenta como un tipo distinto (no `heartbeat`) porque el `MqttService` usa el
 * `type` para decidir si invocar `processUplinkForVerification`.
 */
export interface Lw001BgProReadResponsePayload extends Lw001BgProUplinkBase {
  type: 'read_response';
  /** Hex legible del payload completo — útil para auditoría/troubleshooting. */
  rawHex: string;
}

export interface Lw001BgProUnknownPayload extends Lw001BgProUplinkBase {
  type: 'unknown';
  rawHex: string;
}

export type Lw001BgProUplinkPayload =
  | Lw001BgProUplinkHeartbeat
  | Lw001BgProLocationFixedPayload
  | Lw001BgProLocationFailurePayload
  | Lw001BgProShutdownPayload
  | Lw001BgProShockPayload
  | Lw001BgProManDownPayload
  | Lw001BgProTamperAlarmPayload
  | Lw001BgProEventMessagePayload
  | Lw001BgProBatteryConsumptionPayload
  | Lw001BgProReadResponsePayload
  | Lw001BgProGpsLimitPayload
  | Lw001BgProUnknownPayload;

export interface Lw001BgProUplinkParseError {
  ok: false;
  reason: string;
  fPort: number;
  rawHex: string;
}

export type Lw001BgProUplinkParseResult = Lw001BgProUplinkPayload | Lw001BgProUplinkParseError;
