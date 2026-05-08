/**
 * MOKO LW001-BG PRO — constantes de protocolo.
 *
 * Fuentes:
 *  - LW001-BG Pro Downlink Command V1.2 (PDF MOKO).
 *  - LW001-BG PRO Product Specification V1.1 (PDF MOKO).
 *
 * No exportar valores que no estén directamente respaldados por los PDFs.
 */

/** fPort LoRaWAN para downlinks. */
export const LW001_BG_PRO_DOWNLINK_PORTS = {
  GENERAL_COMMANDS: 10,
  LOCAL_STORAGE_DATA: 11,
} as const;

/** fPort LoRaWAN para uplinks (referencia para parsing). */
export const LW001_BG_PRO_UPLINK_PORTS = {
  HEARTBEAT: 1,
  LOCATION_FIXED: 2,
  LOCATION_FAILURE: 3,
  SHUTDOWN: 4,
  SHOCK: 5,
  MAN_DOWN: 6,
  TAMPER_ALARM: 7,
  EVENT_MESSAGE: 8,
  BATTERY_CONSUMPTION: 9,
  /**
   * Respuestas a CMD `Read parameters` enviadas por el firmware en el mismo puerto que se
   * usa para downlinks de comandos generales (10). El firmware del LW001-BG PRO replica las
   * lecturas TLV `Length+ID+Value` en este puerto, justo después de la cabecera común de 3
   * bytes. Confirmado en producción con bloques de pocos parámetros (≤ ~16 IDs).
   */
  GENERAL_COMMANDS_RESPONSE: 10,
  GPS_LIMIT: 12,
} as const;

/** Byte 0 del downlink — tipo de comando. */
export const LW001_BG_PRO_CMD = {
  CONTROL: 0x00,
  READ: 0x01,
  CONFIGURE: 0x02,
} as const;

/** Sub-comandos para CMD = 0x00 (Control), Port 10. */
export const LW001_BG_PRO_CONTROL_COMMANDS = {
  REBOOT: 0x00,
  DOWNLINK_FOR_POSITION: 0x01,
  ENABLE_BLUETOOTH_BROADCAST: 0x02,
  CLEAR_MAN_DOWN: 0x03,
  REQUEST_BATTERY_CONSUMPTION: 0x04,
  FACTORY_RESET: 0x05,
} as const;

/** Sub-comandos del Local Storage Data Command (Port 11). */
export const LW001_BG_PRO_LOCAL_STORAGE_COMMANDS = {
  UPLOAD_LAST_DAYS: 0x00, // sigue 2 bytes BE (1..65535; 0xFFFF = todo)
  CLEAR_ALL: 0x01,
  PAUSE_UPLOAD: 0x02,
  RESUME_UPLOAD: 0x03,
} as const;

/**
 * IDs de parámetros del PDF v1.2 (capítulos 2.2 Read y 2.3 Configure).
 * Los nombres siguen el camelCase del proyecto. Los valores HEX vienen del PDF.
 */
export const LW001_BG_PRO_PARAM_IDS = {
  // 6.1 Generales
  TIME_ZONE: 0x04,
  LOGIN_PASSWORD: 0x05,
  WORKING_MODE: 0x06,
  DEFAULT_POWER_STATUS: 0x07,
  HEARTBEAT_INTERVAL: 0x08,
  OFF_BY_MAGNET_SWITCH: 0x09,
  SHUTDOWN_PAYLOAD_SWITCH: 0x0a,
  OFFLINE_FIX_SWITCH: 0x0b,
  LOW_POWER_SETTING: 0x0c,
  LED_INDICATOR_SETTING: 0x0d,

  // 6.2 Periodic
  PERIODIC_POSITIONING_STRATEGY: 0x20,
  PERIODIC_REPORT_INTERVAL: 0x21,

  // 6.3 Timing
  TIMING_POSITIONING_STRATEGY: 0x22,
  TIMING_REPORT_POINTS: 0x23,

  // 6.4 Motion
  MOTION_MODE_SETTING: 0x24,
  MOTION_NUMBER_OF_FIX_ON_TRIP_START: 0x25,
  MOTION_POSITION_STRATEGY_ON_TRIP_START: 0x26,
  MOTION_REPORT_INTERVAL_IN_TRIP: 0x27,
  MOTION_POSITION_STRATEGY_IN_TRIP: 0x28,
  MOTION_TRIP_END_TIMEOUT: 0x29,
  MOTION_NUMBER_OF_FIX_ON_TRIP_END: 0x2a,
  MOTION_REPORT_INTERVAL_ON_TRIP_END: 0x2b,
  MOTION_POSITION_STRATEGY_ON_TRIP_END: 0x2c,

  // 6.5 Downlink for Position
  DOWNLINK_FOR_POSITION_STRATEGY: 0x2d,

  // 6.6 WiFi/BT tuning
  WIFI_FIX_TIMEOUT: 0x30,
  NUMBER_OF_WIFI_BSSID: 0x31,
  BLUETOOTH_FIX_TIMEOUT: 0x32,
  NUMBER_OF_BT_DEVICES_IN_BLE_FIX: 0x33,

  // 6.7 Filter Conditions A
  FILTER_AB_RELATION: 0x34,
  FILTER_A_SWITCH: 0x35,
  FILTER_A_ADV_NAME: 0x36,
  FILTER_A_MAC: 0x37,
  FILTER_A_MAJOR: 0x38,
  FILTER_A_MINOR: 0x39,
  FILTER_A_RAW_DATA: 0x3a,
  FILTER_A_UUID: 0x3b,
  FILTER_A_RSSI: 0x3c,
  // Filter B
  FILTER_B_SWITCH: 0x3e,
  FILTER_B_ADV_NAME: 0x3f,
  FILTER_B_MAC: 0x40,
  FILTER_B_MAJOR: 0x41,
  FILTER_B_MINOR: 0x42,
  FILTER_B_RAW_DATA: 0x43,
  FILTER_B_UUID: 0x44,
  FILTER_B_RSSI: 0x45,

  // 6.8 GPS avanzado
  COARSE_ACCURACY_MASK: 0x48,
  FINE_ACCURACY_MASK: 0x49,
  COARSE_TIMEOUT: 0x4a,
  FINE_TIMEOUT: 0x4b,
  PDOP_LIMIT: 0x4c,
  FIX_MODE: 0x4d,
  GPS_MODEL: 0x4e,
  GPS_TIME_BUDGET: 0x4f,
  AUTONOMOUS_AIDING_SWITCH: 0x50,
  AIDING_ACCURACY: 0x51,
  AIDING_TIMEOUT: 0x52,
  GPS_EXTREME_MODE_SWITCH: 0x53,

  // 6.9 LoRaWAN sensibles
  REGION: 0x60,
  LORAWAN_MODE: 0x61,
  DEVEUI: 0x63,
  APPEUI: 0x64,
  APPKEY: 0x65,
  DEVADDR: 0x66,
  APPSKEY: 0x67,
  NWKSKEY: 0x68,
  MESSAGE_TYPE: 0x69,
  CH: 0x6a,
  DR_FOR_JOIN: 0x6b,
  UPLINK_STRATEGY: 0x6c,
  DUTY_CYCLE_SWITCH: 0x6d,

  // 6.10 Tiempo
  TIME_SYNC_INTERVAL: 0x6e,
  RECONNECT_INTERVAL: 0x6f,

  // 6.11 Bluetooth beacon
  BT_BEACON_MODE_SWITCH: 0x70,
  BT_ADV_INTERVAL_BEACON: 0x71,
  BT_CONNECTABLE_STATE: 0x72,
  BT_CONFIG_BROADCAST_TIMEOUT: 0x73,
  BT_BEACON_UUID: 0x74,
  BT_BEACON_MAJOR: 0x75,
  BT_BEACON_MINOR: 0x76,
  BT_MEASURED_POWER: 0x77,
  BT_TX_POWER: 0x78,
  BT_ADV_NAME: 0x79,
  BT_SCANNING_TYPE: 0x7a,

  // 6.12 3-Axis y detecciones
  ACCEL_WAKEUP: 0x80,
  ACCEL_MOTION: 0x81,
  SHOCK_DETECTION_SWITCH: 0x82,
  SHOCK_THRESHOLD: 0x83,
  SHOCK_REPORT_INTERVAL: 0x84,
  SHOCK_TIMEOUT: 0x85,
  MAN_DOWN_DETECTION_SWITCH: 0x86,
  IDLE_DETECTION_TIMEOUT: 0x87,
  TAMPER_ALARM_SWITCH: 0x88,
  ACTIVE_STATE_COUNT_SWITCH: 0x89,
  ACTIVE_STATE_TIMEOUT: 0x8a,
} as const;

/** IDs marcados como peligrosos: el codec puede generar lectura, pero el endpoint REST no los acepta. */
export const LW001_BG_PRO_DANGEROUS_PARAM_IDS: ReadonlySet<number> = new Set([
  LW001_BG_PRO_PARAM_IDS.LOGIN_PASSWORD,
  LW001_BG_PRO_PARAM_IDS.REGION,
  LW001_BG_PRO_PARAM_IDS.LORAWAN_MODE,
  LW001_BG_PRO_PARAM_IDS.DEVEUI,
  LW001_BG_PRO_PARAM_IDS.APPEUI,
  LW001_BG_PRO_PARAM_IDS.APPKEY,
  LW001_BG_PRO_PARAM_IDS.DEVADDR,
  LW001_BG_PRO_PARAM_IDS.APPSKEY,
  LW001_BG_PRO_PARAM_IDS.NWKSKEY,
  LW001_BG_PRO_PARAM_IDS.MESSAGE_TYPE,
  LW001_BG_PRO_PARAM_IDS.CH,
  LW001_BG_PRO_PARAM_IDS.DR_FOR_JOIN,
  LW001_BG_PRO_PARAM_IDS.UPLINK_STRATEGY,
  LW001_BG_PRO_PARAM_IDS.DUTY_CYCLE_SWITCH,
]);

/** Mapeo nombre humano → ID, para aceptar `parameterIds: ['workingMode']` en endpoints. */
export const LW001_BG_PRO_PARAM_NAME_TO_ID: Readonly<Record<string, number>> = {
  timeZone: LW001_BG_PRO_PARAM_IDS.TIME_ZONE,
  loginPassword: LW001_BG_PRO_PARAM_IDS.LOGIN_PASSWORD,
  workingMode: LW001_BG_PRO_PARAM_IDS.WORKING_MODE,
  defaultPowerStatus: LW001_BG_PRO_PARAM_IDS.DEFAULT_POWER_STATUS,
  heartbeatInterval: LW001_BG_PRO_PARAM_IDS.HEARTBEAT_INTERVAL,
  offByMagnetSwitch: LW001_BG_PRO_PARAM_IDS.OFF_BY_MAGNET_SWITCH,
  shutdownPayloadSwitch: LW001_BG_PRO_PARAM_IDS.SHUTDOWN_PAYLOAD_SWITCH,
  offlineFixSwitch: LW001_BG_PRO_PARAM_IDS.OFFLINE_FIX_SWITCH,
  lowPowerSetting: LW001_BG_PRO_PARAM_IDS.LOW_POWER_SETTING,
  ledIndicatorSetting: LW001_BG_PRO_PARAM_IDS.LED_INDICATOR_SETTING,

  periodicPositioningStrategy: LW001_BG_PRO_PARAM_IDS.PERIODIC_POSITIONING_STRATEGY,
  periodicReportInterval: LW001_BG_PRO_PARAM_IDS.PERIODIC_REPORT_INTERVAL,

  timingPositioningStrategy: LW001_BG_PRO_PARAM_IDS.TIMING_POSITIONING_STRATEGY,
  timingReportPoints: LW001_BG_PRO_PARAM_IDS.TIMING_REPORT_POINTS,

  motionModeSetting: LW001_BG_PRO_PARAM_IDS.MOTION_MODE_SETTING,
  motionNumberOfFixOnTripStart: LW001_BG_PRO_PARAM_IDS.MOTION_NUMBER_OF_FIX_ON_TRIP_START,
  motionPositionStrategyOnTripStart: LW001_BG_PRO_PARAM_IDS.MOTION_POSITION_STRATEGY_ON_TRIP_START,
  motionReportIntervalInTrip: LW001_BG_PRO_PARAM_IDS.MOTION_REPORT_INTERVAL_IN_TRIP,
  motionPositionStrategyInTrip: LW001_BG_PRO_PARAM_IDS.MOTION_POSITION_STRATEGY_IN_TRIP,
  motionTripEndTimeout: LW001_BG_PRO_PARAM_IDS.MOTION_TRIP_END_TIMEOUT,
  motionNumberOfFixOnTripEnd: LW001_BG_PRO_PARAM_IDS.MOTION_NUMBER_OF_FIX_ON_TRIP_END,
  motionReportIntervalOnTripEnd: LW001_BG_PRO_PARAM_IDS.MOTION_REPORT_INTERVAL_ON_TRIP_END,
  motionPositionStrategyOnTripEnd: LW001_BG_PRO_PARAM_IDS.MOTION_POSITION_STRATEGY_ON_TRIP_END,

  downlinkForPositionStrategy: LW001_BG_PRO_PARAM_IDS.DOWNLINK_FOR_POSITION_STRATEGY,

  wifiFixTimeout: LW001_BG_PRO_PARAM_IDS.WIFI_FIX_TIMEOUT,
  numberOfWifiBssid: LW001_BG_PRO_PARAM_IDS.NUMBER_OF_WIFI_BSSID,
  bluetoothFixTimeout: LW001_BG_PRO_PARAM_IDS.BLUETOOTH_FIX_TIMEOUT,
  numberOfBtDevicesInBleFix: LW001_BG_PRO_PARAM_IDS.NUMBER_OF_BT_DEVICES_IN_BLE_FIX,

  coarseAccuracyMask: LW001_BG_PRO_PARAM_IDS.COARSE_ACCURACY_MASK,
  fineAccuracyMask: LW001_BG_PRO_PARAM_IDS.FINE_ACCURACY_MASK,
  coarseTimeout: LW001_BG_PRO_PARAM_IDS.COARSE_TIMEOUT,
  fineTimeout: LW001_BG_PRO_PARAM_IDS.FINE_TIMEOUT,
  pdopLimit: LW001_BG_PRO_PARAM_IDS.PDOP_LIMIT,
  fixMode: LW001_BG_PRO_PARAM_IDS.FIX_MODE,
  gpsModel: LW001_BG_PRO_PARAM_IDS.GPS_MODEL,
  gpsTimeBudget: LW001_BG_PRO_PARAM_IDS.GPS_TIME_BUDGET,
  autonomousAidingSwitch: LW001_BG_PRO_PARAM_IDS.AUTONOMOUS_AIDING_SWITCH,
  aidingAccuracy: LW001_BG_PRO_PARAM_IDS.AIDING_ACCURACY,
  aidingTimeout: LW001_BG_PRO_PARAM_IDS.AIDING_TIMEOUT,
  gpsExtremeModeSwitch: LW001_BG_PRO_PARAM_IDS.GPS_EXTREME_MODE_SWITCH,

  region: LW001_BG_PRO_PARAM_IDS.REGION,
  lorawanMode: LW001_BG_PRO_PARAM_IDS.LORAWAN_MODE,
  appKey: LW001_BG_PRO_PARAM_IDS.APPKEY,
  appsKey: LW001_BG_PRO_PARAM_IDS.APPSKEY,
  nwkSKey: LW001_BG_PRO_PARAM_IDS.NWKSKEY,

  timeSyncInterval: LW001_BG_PRO_PARAM_IDS.TIME_SYNC_INTERVAL,
  reconnectInterval: LW001_BG_PRO_PARAM_IDS.RECONNECT_INTERVAL,

  shockDetectionSwitch: LW001_BG_PRO_PARAM_IDS.SHOCK_DETECTION_SWITCH,
  shockThreshold: LW001_BG_PRO_PARAM_IDS.SHOCK_THRESHOLD,
  shockReportInterval: LW001_BG_PRO_PARAM_IDS.SHOCK_REPORT_INTERVAL,
  shockTimeout: LW001_BG_PRO_PARAM_IDS.SHOCK_TIMEOUT,
  manDownDetectionSwitch: LW001_BG_PRO_PARAM_IDS.MAN_DOWN_DETECTION_SWITCH,
  idleDetectionTimeout: LW001_BG_PRO_PARAM_IDS.IDLE_DETECTION_TIMEOUT,
  tamperAlarmSwitch: LW001_BG_PRO_PARAM_IDS.TAMPER_ALARM_SWITCH,
  activeStateCountSwitch: LW001_BG_PRO_PARAM_IDS.ACTIVE_STATE_COUNT_SWITCH,
  activeStateTimeout: LW001_BG_PRO_PARAM_IDS.ACTIVE_STATE_TIMEOUT,
};

/** Inverso del mapa anterior — útil para serializar respuestas leídas. */
export const LW001_BG_PRO_PARAM_ID_TO_NAME: Readonly<Record<number, string>> = Object.freeze(
  Object.entries(LW001_BG_PRO_PARAM_NAME_TO_ID).reduce<Record<number, string>>(
    (acc, [name, id]) => {
      acc[id] = name;
      return acc;
    },
    {},
  ),
);

/** Todos los IDs de parámetro definidos en el PDF (sin duplicados), ordenados. */
const LW001_BG_PRO_ALL_DISTINCT_PARAM_IDS: readonly number[] = Object.freeze(
  Array.from(
    new Set<number>(Object.values(LW001_BG_PRO_PARAM_IDS) as number[]),
  ).sort((a, b) => a - b),
);

/**
 * IDs de parámetro que se pueden solicitar por Read desde la API pública
 * (excluye keys/region/mode peligrosos según `LW001_BG_PRO_DANGEROUS_PARAM_IDS`).
 */
export function lw001BgProSafeReadParameterIds(): readonly number[] {
  return LW001_BG_PRO_ALL_DISTINCT_PARAM_IDS.filter(
    (id) => !LW001_BG_PRO_DANGEROUS_PARAM_IDS.has(id),
  );
}

/**
 * Máximo de IDs por trama `CMD=Read` (0x01 id1 id2 …) para caber en payload LoRa
 * conservador; el resto se divide en varios downlinks encolados en orden.
 */
export const LW001_BG_PRO_READ_PARAMETERS_IDS_PER_DOWNLINK_MAX = 32;

/**
 * Categorías lógicas por bloque (tomadas del agrupamiento operativo del PDF MOKO).
 *
 * Los sufijos `A`, `B`, `C` corresponden a sub-bloques que se introdujeron tras observar
 * en producción que el firmware del LW001-BG PRO no respondía con TLV cuando el bloque
 * original tenía 11+ IDs. Cada sub-bloque mantiene el mismo dominio lógico pero con
 * una respuesta más corta. Los bloques que ya respondían bien (`general`,
 * `wifiBluetoothBasic`, `bleFilterA/B`, `bluetoothPassword`, `lorawanKeys`) se mantienen
 * sin sufijo para no romper presets existentes.
 */
export type Lw001BgProReadBlockCategory =
  | 'general'
  | 'periodicTimingMotionA'
  | 'periodicTimingMotionB'
  | 'periodicTimingMotionC'
  | 'wifiBluetoothBasic'
  | 'bleFilterA'
  | 'bleFilterB'
  | 'gpsA'
  | 'gpsB'
  | 'lorawanBasicA'
  | 'lorawanBasicB'
  | 'lorawanBasicC'
  | 'bluetoothBroadcastA'
  | 'bluetoothBroadcastB'
  | 'sensorsAndAlertsA'
  | 'sensorsAndAlertsB'
  | 'bluetoothPassword'
  | 'lorawanKeys';

/** Un bloque de la lectura masiva segura (mismo criterio que `readAllSafeParameters`). */
export interface Lw001BgProSafeReadChunkDescriptor {
  readonly chunkIndex: number;
  readonly category: Lw001BgProReadBlockCategory;
  readonly parameterIds: readonly number[];
  readonly parameterNames: readonly string[];
}

/**
 * Bloques de Read predefinidos, agrupados por categoría lógica del PDF MOKO LW001-BG PRO.
 *
 * Estos 18 bloques son el resultado de subdividir los 5 bloques originales que el
 * firmware no respondía con TLV (Periodic/Timing/Motion, GPS, LoRaWAN básico,
 * Bluetooth broadcast, Sensores/alertas). Los bloques que sí respondían se mantienen
 * intactos:
 *   - `general` (0x04..0x0d)
 *   - `wifiBluetoothBasic` (0x30..0x45 selectos)
 *   - `bleFilterA` y `bleFilterB`
 *   - `bluetoothPassword` y `lorawanKeys`
 *
 * Cada sub-bloque tiene 6 IDs o menos para que la respuesta TLV quepa cómodamente en
 * un solo uplink incluso si el firmware no fragmenta. El operador puede pulsar cada
 * sub-bloque por separado en la UI y verificar individualmente cuáles son aceptados.
 *
 * Importante: los bloques `bluetoothPassword` y `lorawanKeys` incluyen IDs **sensibles**
 * (LOGIN_PASSWORD, APPKEY, APPSKEY, NWKSKEY). El endpoint genérico `read` los sigue
 * rechazando vía `LW001_BG_PRO_DANGEROUS_PARAM_IDS`; este preset es la única vía de
 * leerlos por radio y solo expone IDs (no acepta nombres arbitrarios del cliente).
 */
const READ_BLOCK_DEFINITIONS: readonly {
  category: Lw001BgProReadBlockCategory;
  parameterIds: readonly number[];
}[] = [
  // 0 — General (sin cambios; respondió OK).
  {
    category: 'general',
    parameterIds: [0x04, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d],
  },
  // 1..3 — Periodic / Timing / Motion (subdividido en 3 sub-bloques).
  {
    category: 'periodicTimingMotionA',
    // Position+report periodic + Position timing + Timing point + Motion mode
    parameterIds: [0x20, 0x21, 0x22, 0x23, 0x24],
  },
  {
    category: 'periodicTimingMotionB',
    // Number-of-fix on start + Position strategies + Report interval in trip
    parameterIds: [0x25, 0x26, 0x27, 0x28, 0x29],
  },
  {
    category: 'periodicTimingMotionC',
    // Trip-end count + intervals + downlink-for-position strategy
    parameterIds: [0x2a, 0x2b, 0x2c, 0x2d],
  },
  // 4 — WiFi/Bluetooth básico + filtros globales (sin cambios; respondió OK).
  {
    category: 'wifiBluetoothBasic',
    parameterIds: [0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x3c, 0x3e, 0x45],
  },
  // 5 — Filtros BLE A (sin cambios; reintenta tal cual).
  {
    category: 'bleFilterA',
    parameterIds: [0x36, 0x37, 0x38, 0x39, 0x3a, 0x3b],
  },
  // 6 — Filtros BLE B (sin cambios; respondió OK).
  {
    category: 'bleFilterB',
    parameterIds: [0x3f, 0x40, 0x41, 0x42, 0x43, 0x44],
  },
  // 7..8 — GPS (subdividido en 2 sub-bloques).
  {
    category: 'gpsA',
    // Coarse/fine accuracy + timeouts + PDOP + fix mode
    parameterIds: [0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d],
  },
  {
    category: 'gpsB',
    // GPS model + time budget + autonomous aiding + extreme mode
    parameterIds: [0x4e, 0x4f, 0x50, 0x51, 0x52, 0x53],
  },
  // 9..11 — LoRaWAN básico (subdividido en 3 sub-bloques).
  {
    category: 'lorawanBasicA',
    // Region + LoRaWAN mode + DEVEUI + APPEUI
    parameterIds: [0x60, 0x61, 0x63, 0x64],
  },
  {
    category: 'lorawanBasicB',
    // Message type + CH + DR for join + uplink strategy
    parameterIds: [0x69, 0x6a, 0x6b, 0x6c],
  },
  {
    category: 'lorawanBasicC',
    // Duty-cycle + time-sync interval + reconnect interval
    parameterIds: [0x6d, 0x6e, 0x6f],
  },
  // 12..13 — Bluetooth broadcast (subdividido en 2 sub-bloques).
  {
    category: 'bluetoothBroadcastA',
    // Beacon mode switch + ADV interval + connectable + config-mode timeout + UUID
    parameterIds: [0x70, 0x71, 0x72, 0x73, 0x74],
  },
  {
    category: 'bluetoothBroadcastB',
    // Major + Minor + Measured Power + TX power + ADV name + scanning PHY
    parameterIds: [0x75, 0x76, 0x77, 0x78, 0x79, 0x7a],
  },
  // 14..15 — Sensores y alertas (subdividido en 2 sub-bloques).
  {
    category: 'sensorsAndAlertsA',
    // Wakeup/motion thresholds + shock switch + threshold + report interval
    parameterIds: [0x80, 0x81, 0x82, 0x83, 0x84, 0x85],
  },
  {
    category: 'sensorsAndAlertsB',
    // Man down + idle timeout + tamper + active state count + active state timeout
    parameterIds: [0x86, 0x87, 0x88, 0x89, 0x8a],
  },
  // 16..17 — Sensibles (sin cambios).
  { category: 'bluetoothPassword', parameterIds: [0x05] },
  { category: 'lorawanKeys', parameterIds: [0x05, 0x65, 0x67, 0x68] },
];

/**
 * Devuelve los 18 bloques predefinidos para Read. La forma del descriptor coincide con
 * lo que el frontend ya consume; los nombres de parámetro caen a `id0xNN` cuando un ID
 * no tiene mapeo público en `LW001_BG_PRO_PARAM_NAME_TO_ID`.
 */
export function lw001BgProSafeReadParameterChunks(): readonly Lw001BgProSafeReadChunkDescriptor[] {
  return Object.freeze(
    READ_BLOCK_DEFINITIONS.map((def, chunkIndex) => ({
      chunkIndex,
      category: def.category,
      parameterIds: def.parameterIds,
      parameterNames: def.parameterIds.map(
        (id) =>
          LW001_BG_PRO_PARAM_ID_TO_NAME[id] ??
          `id0x${id.toString(16).padStart(2, '0')}`,
      ),
    })),
  );
}
