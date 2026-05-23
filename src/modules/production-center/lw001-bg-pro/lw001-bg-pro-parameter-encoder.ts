import { BadRequestException } from '@nestjs/common';
import { Lw001BgProDownlinkCodecService } from './lw001-bg-pro-downlink-codec.service';
import {
  LW001_BG_PRO_DANGEROUS_PARAM_IDS,
  LW001_BG_PRO_PARAM_NAME_TO_ID,
} from './lw001-bg-pro.constants';
import {
  Lw001BgProBtScanningType,
  Lw001BgProDefaultPowerStatus,
  Lw001BgProFixMode,
  Lw001BgProGpsModel,
  Lw001BgProLedIndicatorSetting,
  Lw001BgProLowPowerSetting,
  Lw001BgProMessageType,
  Lw001BgProMotionModeSettings,
  Lw001BgProPositioningStrategy,
  Lw001BgProRegion,
  Lw001BgProWorkingMode,
} from './lw001-bg-pro.types';

/**
 * Encoder de un parámetro nombrado (camelCase) → bloque Buffer del configure.
 *
 * Cada handler recibe el codec + valor crudo; debe retornar el buffer producido por
 * `buildConfigure*` correspondiente. Solo se expone para `parameters` no peligrosos.
 */
type ParameterHandler = (codec: Lw001BgProDownlinkCodecService, value: unknown) => Buffer;

const requireBoolean = (key: string, value: unknown): boolean => {
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`Parameter ${key} must be boolean, got ${typeof value}`);
  }
  return value;
};

const requireNumber = (key: string, value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException(`Parameter ${key} must be number, got ${typeof value}`);
  }
  return value;
};

const requireString = (key: string, value: unknown): string => {
  if (typeof value !== 'string') {
    throw new BadRequestException(`Parameter ${key} must be string, got ${typeof value}`);
  }
  return value;
};

const requirePositioningStrategy = (key: string, value: unknown): Lw001BgProPositioningStrategy => {
  if (typeof value !== 'object' || value === null) {
    throw new BadRequestException(`Parameter ${key} must be { wifi, bluetooth, gps }`);
  }
  const v = value as Record<string, unknown>;
  return {
    wifi: !!v.wifi,
    bluetooth: !!v.bluetooth,
    gps: !!v.gps,
  };
};

const requireMotionModeSettings = (key: string, value: unknown): Lw001BgProMotionModeSettings => {
  if (typeof value !== 'object' || value === null) {
    throw new BadRequestException(`Parameter ${key} must be motion mode settings object`);
  }
  const v = value as Record<string, unknown>;
  return {
    notifyEventOnStart: !!v.notifyEventOnStart,
    fixOnStart: !!v.fixOnStart,
    notifyEventInTrip: !!v.notifyEventInTrip,
    fixInTrip: !!v.fixInTrip,
    notifyEventOnEnd: !!v.notifyEventOnEnd,
    fixOnEnd: !!v.fixOnEnd,
  };
};

const requireLowPowerSetting = (key: string, value: unknown): Lw001BgProLowPowerSetting => {
  if (typeof value !== 'object' || value === null) {
    throw new BadRequestException(`Parameter ${key} must be low power setting object`);
  }
  const v = value as Record<string, unknown>;
  return {
    promptAt10Percent: !!v.promptAt10Percent,
    sendLowPowerPayload: !!v.sendLowPowerPayload,
  };
};

const requireLedIndicatorSetting = (
  key: string,
  value: unknown,
): Lw001BgProLedIndicatorSetting => {
  if (typeof value !== 'object' || value === null) {
    throw new BadRequestException(`Parameter ${key} must be LED indicator setting object`);
  }
  const v = value as Record<string, unknown>;
  return {
    tamperAlarm: !!v.tamperAlarm,
    lowPower: !!v.lowPower,
    inBluetoothFix: !!v.inBluetoothFix,
    bluetoothFixSuccess: !!v.bluetoothFixSuccess,
    bluetoothFixFailed: !!v.bluetoothFixFailed,
    inGpsFix: !!v.inGpsFix,
    gpsFixSuccess: !!v.gpsFixSuccess,
    gpsFixFailed: !!v.gpsFixFailed,
    inWifiFix: !!v.inWifiFix,
    wifiFixSuccess: !!v.wifiFixSuccess,
    wifiFixFailed: !!v.wifiFixFailed,
  };
};

const requireNumberArray = (key: string, value: unknown): number[] => {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'number')) {
    throw new BadRequestException(`Parameter ${key} must be a number[]`);
  }
  return value as number[];
};

/**
 * Mapa nombre camelCase → handler. Cada handler invoca el builder específico del codec.
 * Si una clave del input no está en este mapa, el caller debe rechazarla.
 *
 * Parámetros peligrosos (LoRaWAN keys, region, factory reset, login password, etc.) NO están
 * incluidos aquí — el codec sí tiene los builders, pero solo se invocan desde scripts internos.
 */
export const PARAMETER_HANDLERS: Readonly<Record<string, ParameterHandler>> = {
  timeZone: (c, v) => c.buildConfigureTimeZone(requireNumber('timeZone', v)),
  workingMode: (c, v) =>
    c.buildConfigureWorkingMode(requireString('workingMode', v) as Lw001BgProWorkingMode),
  defaultPowerStatus: (c, v) =>
    c.buildConfigureDefaultPowerStatus(
      requireString('defaultPowerStatus', v) as Lw001BgProDefaultPowerStatus,
    ),
  heartbeatInterval: (c, v) => c.buildConfigureHeartbeatInterval(requireNumber('heartbeatInterval', v)),
  offByMagnetSwitch: (c, v) => c.buildConfigureOffByMagnetSwitch(requireBoolean('offByMagnetSwitch', v)),
  shutdownPayloadSwitch: (c, v) =>
    c.buildConfigureShutdownPayloadSwitch(requireBoolean('shutdownPayloadSwitch', v)),
  offlineFixSwitch: (c, v) =>
    c.buildConfigureOfflineFixSwitch(requireBoolean('offlineFixSwitch', v)),
  lowPowerSetting: (c, v) => c.buildConfigureLowPowerSetting(requireLowPowerSetting('lowPowerSetting', v)),
  ledIndicatorSetting: (c, v) =>
    c.buildConfigureLedIndicatorSetting(requireLedIndicatorSetting('ledIndicatorSetting', v)),

  periodicPositioningStrategy: (c, v) =>
    c.buildConfigurePeriodicPositioningStrategy(
      requirePositioningStrategy('periodicPositioningStrategy', v),
    ),
  periodicReportInterval: (c, v) =>
    c.buildConfigurePeriodicReportInterval(requireNumber('periodicReportInterval', v)),

  timingPositioningStrategy: (c, v) =>
    c.buildConfigureTimingPositioningStrategy(
      requirePositioningStrategy('timingPositioningStrategy', v),
    ),
  timingReportPoints: (c, v) =>
    c.buildConfigureTimingReportPoints(requireNumberArray('timingReportPoints', v)),

  motionModeSetting: (c, v) =>
    c.buildConfigureMotionModeSettings(requireMotionModeSettings('motionModeSetting', v)),
  motionNumberOfFixOnTripStart: (c, v) =>
    c.buildConfigureNumberOfFixOnTripStart(requireNumber('motionNumberOfFixOnTripStart', v)),
  motionPositionStrategyOnTripStart: (c, v) =>
    c.buildConfigureMotionPositioningStrategyOnTripStart(
      requirePositioningStrategy('motionPositionStrategyOnTripStart', v),
    ),
  motionReportIntervalInTrip: (c, v) =>
    c.buildConfigureMotionReportIntervalInTrip(requireNumber('motionReportIntervalInTrip', v)),
  motionPositionStrategyInTrip: (c, v) =>
    c.buildConfigureMotionPositioningStrategyInTrip(
      requirePositioningStrategy('motionPositionStrategyInTrip', v),
    ),
  motionTripEndTimeout: (c, v) => c.buildConfigureTripEndTimeout(requireNumber('motionTripEndTimeout', v)),
  motionNumberOfFixOnTripEnd: (c, v) =>
    c.buildConfigureNumberOfFixOnTripEnd(requireNumber('motionNumberOfFixOnTripEnd', v)),
  motionReportIntervalOnTripEnd: (c, v) =>
    c.buildConfigureReportIntervalOnTripEnd(requireNumber('motionReportIntervalOnTripEnd', v)),
  motionPositionStrategyOnTripEnd: (c, v) =>
    c.buildConfigureMotionPositioningStrategyOnTripEnd(
      requirePositioningStrategy('motionPositionStrategyOnTripEnd', v),
    ),

  downlinkForPositionStrategy: (c, v) =>
    c.buildConfigureDownlinkForPositionStrategy(
      requirePositioningStrategy('downlinkForPositionStrategy', v),
    ),

  wifiFixTimeout: (c, v) => c.buildConfigureWifiFixTimeout(requireNumber('wifiFixTimeout', v)),
  numberOfWifiBssid: (c, v) => c.buildConfigureNumberOfWifiBssid(requireNumber('numberOfWifiBssid', v)),
  bluetoothFixTimeout: (c, v) =>
    c.buildConfigureBluetoothFixTimeout(requireNumber('bluetoothFixTimeout', v)),
  numberOfBtDevicesInBleFix: (c, v) =>
    c.buildConfigureNumberOfBtDevicesInBleFix(requireNumber('numberOfBtDevicesInBleFix', v)),

  coarseAccuracyMask: (c, v) =>
    c.buildConfigureCoarseAccuracyMask(requireNumber('coarseAccuracyMask', v)),
  fineAccuracyMask: (c, v) => c.buildConfigureFineAccuracyMask(requireNumber('fineAccuracyMask', v)),
  coarseTimeout: (c, v) => c.buildConfigureCoarseTimeout(requireNumber('coarseTimeout', v)),
  fineTimeout: (c, v) => c.buildConfigureFineTimeout(requireNumber('fineTimeout', v)),
  pdopLimit: (c, v) => c.buildConfigurePdopLimit(requireNumber('pdopLimit', v)),
  fixMode: (c, v) => c.buildConfigureFixMode(requireString('fixMode', v) as Lw001BgProFixMode),
  gpsModel: (c, v) => c.buildConfigureGpsModel(requireString('gpsModel', v) as Lw001BgProGpsModel),
  gpsTimeBudget: (c, v) => c.buildConfigureGpsTimeBudget(requireNumber('gpsTimeBudget', v)),
  autonomousAidingSwitch: (c, v) =>
    c.buildConfigureAutonomousAidingSwitch(requireBoolean('autonomousAidingSwitch', v)),
  aidingAccuracy: (c, v) => c.buildConfigureAidingAccuracy(requireNumber('aidingAccuracy', v)),
  aidingTimeout: (c, v) => c.buildConfigureAidingTimeout(requireNumber('aidingTimeout', v)),
  gpsExtremeModeSwitch: (c, v) =>
    c.buildConfigureGpsExtremeModeSwitch(requireBoolean('gpsExtremeModeSwitch', v)),

  timeSyncInterval: (c, v) => c.buildConfigureTimeSyncInterval(requireNumber('timeSyncInterval', v)),
  reconnectInterval: (c, v) => c.buildConfigureReconnectInterval(requireNumber('reconnectInterval', v)),

  shockDetectionSwitch: (c, v) =>
    c.buildConfigureShockDetectionSwitch(requireBoolean('shockDetectionSwitch', v)),
  shockThreshold: (c, v) => c.buildConfigureShockThreshold(requireNumber('shockThreshold', v)),
  shockReportInterval: (c, v) =>
    c.buildConfigureShockReportInterval(requireNumber('shockReportInterval', v)),
  shockTimeout: (c, v) => c.buildConfigureShockTimeout(requireNumber('shockTimeout', v)),
  manDownDetectionSwitch: (c, v) =>
    c.buildConfigureManDownDetectionSwitch(requireBoolean('manDownDetectionSwitch', v)),
  idleDetectionTimeout: (c, v) =>
    c.buildConfigureIdleDetectionTimeout(requireNumber('idleDetectionTimeout', v)),
  tamperAlarmSwitch: (c, v) =>
    c.buildConfigureTamperAlarmSwitch(requireBoolean('tamperAlarmSwitch', v)),
  activeStateCountSwitch: (c, v) =>
    c.buildConfigureActiveStateCountSwitch(requireBoolean('activeStateCountSwitch', v)),
  activeStateTimeout: (c, v) =>
    c.buildConfigureActiveStateTimeout(requireNumber('activeStateTimeout', v)),
};

/** Umbral por defecto: 30 × 10 mg = 300 mg (rango PDF/codec 10–255). */
const DEFAULT_SHOCK_THRESHOLD_UNITS = 30;
/** Segundos antes de considerar fin de shock (codec 1–20 s). */
const DEFAULT_SHOCK_TIMEOUT_S = 15;
/** Intervalo entre reportes de shock (codec 3–255 s). 255 minimiza el tráfico. */
const DEFAULT_SHOCK_REPORT_INTERVAL_S = 255;
/** Horas sin movimiento antes de man-down (codec 1–8760 h). */
const DEFAULT_IDLE_DETECTION_TIMEOUT_H = 120;

/**
 * Fuerza `shockDetectionSwitch` y `manDownDetectionSwitch` a `true` y rellena
 * parámetros relacionados cuando faltan o están fuera de rango.
 *
 * El PDF no exige explícitamente todos los subcampos, pero sin ellos el collar
 * puede usar valores impredecibles; además el codec rechaza umbrales/tiempos inválidos.
 */
export function mergeLw001ShockAndManDownDefaults(
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...parameters };
  out.shockDetectionSwitch = true;
  out.manDownDetectionSwitch = true;

  const thresh = out.shockThreshold;
  const threshNum = typeof thresh === 'number' && Number.isFinite(thresh) ? thresh : NaN;
  if (!Number.isFinite(threshNum) || threshNum < 10 || threshNum > 255) {
    out.shockThreshold = DEFAULT_SHOCK_THRESHOLD_UNITS;
  }

  const st = out.shockTimeout;
  const stNum = typeof st === 'number' && Number.isFinite(st) ? st : NaN;
  if (!Number.isFinite(stNum) || stNum < 1 || stNum > 20) {
    out.shockTimeout = DEFAULT_SHOCK_TIMEOUT_S;
  }

  const sri = out.shockReportInterval;
  const sriNum = typeof sri === 'number' && Number.isFinite(sri) ? sri : NaN;
  if (!Number.isFinite(sriNum) || sriNum < 3 || sriNum > 255) {
    out.shockReportInterval = DEFAULT_SHOCK_REPORT_INTERVAL_S;
  }

  const idle = out.idleDetectionTimeout;
  const idleNum = typeof idle === 'number' && Number.isFinite(idle) ? idle : NaN;
  if (!Number.isFinite(idleNum) || idleNum < 1 || idleNum > 8760) {
    out.idleDetectionTimeout = DEFAULT_IDLE_DETECTION_TIMEOUT_H;
  }

  return out;
}

/** Throws BadRequestException si parameters incluye claves peligrosas o no soportadas. */
export function assertSafeAndSupportedParameters(parameters: Record<string, unknown>): void {
  for (const key of Object.keys(parameters)) {
    if (!(key in PARAMETER_HANDLERS)) {
      throw new BadRequestException(
        `Parameter "${key}" is not supported via REST. Use the appropriate internal script if necessary.`,
      );
    }
    const id = LW001_BG_PRO_PARAM_NAME_TO_ID[key];
    if (id !== undefined && LW001_BG_PRO_DANGEROUS_PARAM_IDS.has(id)) {
      throw new BadRequestException(
        `Parameter "${key}" is dangerous and cannot be modified via REST.`,
      );
    }
  }
}

/** Tipo público auxiliar (re-export) para los servicios. */
export type Lw001BgProBtScanningTypeName = Lw001BgProBtScanningType;
export type Lw001BgProMessageTypeName = Lw001BgProMessageType;
export type Lw001BgProRegionName = Lw001BgProRegion;
