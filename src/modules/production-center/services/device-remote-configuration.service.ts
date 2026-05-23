import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Lw001BgProDownlinkCodecService } from '../lw001-bg-pro/lw001-bg-pro-downlink-codec.service';
import {
  Lw001BgProUplinkParserService,
} from '../lw001-bg-pro/lw001-bg-pro-uplink-parser.service';
import {
  LW001_BG_PRO_DANGEROUS_PARAM_IDS,
  LW001_BG_PRO_DOWNLINK_PORTS,
  LW001_BG_PRO_PARAM_NAME_TO_ID,
  LW001_BG_PRO_READ_PARAMETERS_IDS_PER_DOWNLINK_MAX,
  lw001BgProSafeReadParameterChunks,
  lw001BgProSafeReadParameterIds,
} from '../lw001-bg-pro/lw001-bg-pro.constants';
import {
  PARAMETER_HANDLERS,
  assertSafeAndSupportedParameters,
  mergeLw001ShockAndManDownDefaults,
} from '../lw001-bg-pro/lw001-bg-pro-parameter-encoder';
import {
  Lw001BgProControlCommand,
  Lw001BgProLocalStorageInput,
} from '../lw001-bg-pro/lw001-bg-pro.types';
import { ChirpStackDownlinkService } from './chirpstack-downlink.service';
import { DeviceDownlinkCommandRepository } from '../repositories/device-downlink-command.repository';
import { DeviceRemoteConfigurationRepository } from '../repositories/device-remote-configuration.repository';
import { DeviceConfigurationProfileRepository } from '../repositories/device-configuration-profile.repository';
import { DeviceRepository } from '../repositories/device.repository';
import {
  DeviceDownlinkCommand,
  DeviceDownlinkCommandStatus,
  DeviceDownlinkCommandType,
} from '../entities/device-downlink-command.entity';
import {
  DeviceDiagnosticPreviousValues,
  DeviceDiagnosticState,
  DeviceRemoteConfiguration,
} from '../entities/device-remote-configuration.entity';

/** Resultado de cualquier operación que produce un downlink. */
export interface DownlinkOperationResult {
  command: DeviceDownlinkCommand;
  payloadHex: string;
  queueItemId: string;
}

/** Lectura masiva: varios downlinks READ (chunks). */
export interface ReadAllSafeParametersResult {
  totalParameterIds: number;
  chunksEnqueued: number;
  commands: DownlinkOperationResult[];
}

/** Metadatos de un bloque de lectura segura (sin encolar). */
export interface ReadSafeParametersChunkPlanChunk {
  chunkIndex: number;
  category: string;
  count: number;
  parameterIds: number[];
  parameterNames: string[];
}

/** Plan de bloques para la UI (un botón por bloque). */
export interface ReadSafeParametersChunkPlanResult {
  totalParameterIds: number;
  maxPerFrame: number;
  totalChunks: number;
  chunks: ReadSafeParametersChunkPlanChunk[];
}

/** Comandos de control NO peligrosos expuestos vía REST. */
const SAFE_CONTROL_COMMANDS: ReadonlySet<Lw001BgProControlCommand> = new Set([
  'reboot',
  'downlink_position',
  'enable_bluetooth',
  'clear_man_down',
  'request_battery',
]);

/**
 * Valores que se aplican al device cuando se activa el modo diagnóstico.
 *
 * Objetivo: silenciar uplinks auxiliares (Port 5 shock, Port 6 man-down, Port 7 tamper)
 * y bajar el `heartbeatInterval` al mínimo legal MOKO (300 s) para que los técnicos
 * vean Port 1 (heartbeat) limpio y predecible mientras diagnostican el device.
 *
 * Sin esta neutralización, la regla MOKO "el heartbeat se reagenda con cada uplink"
 * impide ver heartbeats cuando el device está reportando shocks frecuentes.
 */
const DIAGNOSTIC_MODE_PARAMETERS = {
  shockDetectionSwitch: false,
  manDownDetectionSwitch: false,
  tamperAlarmSwitch: false,
  heartbeatInterval: 300,
} as const;

/**
 * Defaults de restauración cuando `desired` no contiene los valores previos.
 * Se aplican como red de seguridad para no dejar al device "sordo" si alguien
 * intenta `disable` sin haber pasado antes por `enable` (no debería ocurrir).
 */
const DIAGNOSTIC_FALLBACK_RESTORE: DeviceDiagnosticPreviousValues = {
  shockDetectionSwitch: true,
  manDownDetectionSwitch: true,
  tamperAlarmSwitch: true,
  heartbeatInterval: 720,
};

/**
 * Parámetros aplicados al activar "Solo LoRaWAN" como estrategia de posicionamiento.
 *
 * Pone los 6 bitmasks de "position strategy" del PDF MOKO en `0x00` (todos los bits
 * apagados): el firmware deja de intentar fixes locales (GPS / WiFi / BT) y la
 * posición la calcula el LNS (ChirpStack) por TDOA/RSSI desde los gateways.
 *
 * Ahorra batería significativamente en escenarios ganaderos donde la cobertura LoRaWAN
 * es buena y la precisión de TDOA es suficiente. Para revertir, se puede usar
 * `configureParameters` con valores `{wifi, bluetooth, gps}` deseados.
 */
const LORAWAN_ONLY_POSITIONING_PARAMETERS: Record<
  string,
  { wifi: boolean; bluetooth: boolean; gps: boolean }
> = {
  periodicPositioningStrategy: { wifi: false, bluetooth: false, gps: false },
  timingPositioningStrategy: { wifi: false, bluetooth: false, gps: false },
  motionPositionStrategyOnTripStart: { wifi: false, bluetooth: false, gps: false },
  motionPositionStrategyInTrip: { wifi: false, bluetooth: false, gps: false },
  motionPositionStrategyOnTripEnd: { wifi: false, bluetooth: false, gps: false },
  downlinkForPositionStrategy: { wifi: false, bluetooth: false, gps: false },
};

/** Default y rango del TTL del modo diagnóstico (minutos). */
const DIAGNOSTIC_TTL_DEFAULT_MIN = 60;
const DIAGNOSTIC_TTL_MIN_MIN = 5;
const DIAGNOSTIC_TTL_MAX_MIN = 240;

/** Periodicidad del cron interno que auto-restaura modos diagnósticos vencidos. */
const DIAGNOSTIC_AUTORESTORE_INTERVAL_MS = 60_000;

/**
 * Servicio orquestador de configuración remota MOKO LW001-BG PRO.
 *
 * Combina:
 *  - Codec puro (`Lw001BgProDownlinkCodecService`) para construir payloads HEX.
 *  - Adapter REST (`ChirpStackDownlinkService`) para encolar.
 *  - Repositorios para persistir comandos, estado y perfiles.
 *  - Parser de uplinks (`Lw001BgProUplinkParserService`) para verificación estricta.
 *
 * Estrategia de confirmación: ESTRICTA. Un downlink CONFIGURE pasa a `APPLIED` solo
 * cuando llega un uplink de respuesta a Read parameters que confirma el valor enviado.
 */
@Injectable()
export class DeviceRemoteConfigurationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeviceRemoteConfigurationService.name);

  /** TTL por defecto de verificación de un downlink (24 horas). */
  private readonly DEFAULT_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

  /** Handle del setInterval que auto-restaura modos diagnósticos vencidos. */
  private diagnosticAutoRestoreTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly codec: Lw001BgProDownlinkCodecService,
    private readonly parser: Lw001BgProUplinkParserService,
    private readonly chirpstack: ChirpStackDownlinkService,
    private readonly deviceRepo: DeviceRepository,
    private readonly profileRepo: DeviceConfigurationProfileRepository,
    private readonly remoteCfgRepo: DeviceRemoteConfigurationRepository,
    private readonly downlinkRepo: DeviceDownlinkCommandRepository,
    private readonly configService?: ConfigService,
  ) {}

  // ============================================================
  // Lifecycle: cron de auto-restauración del modo diagnóstico
  // ============================================================

  onModuleInit(): void {
    // Evitar correr el cron en entorno test (jest define NODE_ENV=test) para no
    // pisar mocks ni dejar timers abiertos. En tests se invoca el método público
    // `runDiagnosticAutoRestoreOnce` cuando se necesita ejercitar la lógica.
    if (process.env.NODE_ENV === 'test') return;
    this.diagnosticAutoRestoreTimer = setInterval(() => {
      void this.runDiagnosticAutoRestoreOnce().catch((e) =>
        this.logger.error(
          `Diagnostic auto-restore tick failed: ${(e as Error).message}`,
        ),
      );
    }, DIAGNOSTIC_AUTORESTORE_INTERVAL_MS);
    this.diagnosticAutoRestoreTimer?.unref?.();
  }

  onModuleDestroy(): void {
    if (this.diagnosticAutoRestoreTimer) {
      clearInterval(this.diagnosticAutoRestoreTimer);
      this.diagnosticAutoRestoreTimer = null;
    }
  }

  // ============================================================
  // Operaciones públicas de alto nivel
  // ============================================================

  /**
   * Aplica un perfil completo al device.
   * - Construye un único `02 ...` con todos los parámetros del perfil.
   * - Encola en ChirpStack.
   * - Crea el `DeviceDownlinkCommand` en estado PENDING_VERIFICATION.
   * - Actualiza `DeviceRemoteConfiguration.desired`.
   * - Inmediatamente encola un READ con los IDs del perfil para verificación estricta.
   */
  async applyProfile(input: {
    deveui: string;
    idTenant: string;
    idProfile: string;
    idUser?: string | null;
  }): Promise<DownlinkOperationResult> {
    const device = await this.deviceRepo.findByDevEuiAndTenantId(input.deveui, input.idTenant);
    const profile = await this.profileRepo.findById(input.idProfile);
    if (profile.idTenant !== null && profile.idTenant !== input.idTenant) {
      throw new NotFoundException(`Profile ${input.idProfile} not found for this tenant`);
    }
    if (!profile.isActive) {
      throw new BadRequestException(`Profile ${profile.code} is not active`);
    }

    const rawParams = profile.parameters ?? {};
    if (Object.keys(rawParams).length === 0) {
      throw new BadRequestException(`Profile ${profile.code} has no parameters configured`);
    }

    const params = mergeLw001ShockAndManDownDefaults({
      ...rawParams,
    }) as Record<string, unknown>;
    assertSafeAndSupportedParameters(params);

    const parts = Object.entries(params).map(([k, v]) =>
      PARAMETER_HANDLERS[k](this.codec, v),
    );
    const buffer = this.codec.buildConfigureMultiple(parts);

    const remoteCfg = await this.remoteCfgRepo.upsertDesired({
      idTenant: input.idTenant,
      idDevice: device.id,
      desired: params,
      idProfile: profile.id,
      profileSnapshot: {
        id: profile.id,
        code: profile.code,
        name: profile.name,
        parameters: params,
      },
    });

    const command = await this.persistAndEnqueue({
      device,
      idTenant: input.idTenant,
      idUser: input.idUser ?? null,
      idProfile: profile.id,
      type: 'CONFIGURE',
      action: `applyProfile:${profile.code}`,
      fPort: LW001_BG_PRO_DOWNLINK_PORTS.GENERAL_COMMANDS,
      buffer,
      parameters: params,
      desiredVersion: remoteCfg.desiredVersion,
      initialStatus: 'PENDING_VERIFICATION',
    });

    // Verificación estricta: encolar READ con todos los IDs del perfil.
    await this.scheduleVerificationRead(
      device,
      input.idTenant,
      input.idUser ?? null,
      Object.keys(params),
      profile.id,
      remoteCfg.desiredVersion,
    );

    return command;
  }

  /** Configura uno o varios parámetros sueltos sin perfil. Mismo flujo de verificación estricta. */
  async configureParameters(input: {
    deveui: string;
    idTenant: string;
    parameters: Record<string, unknown>;
    idUser?: string | null;
  }): Promise<DownlinkOperationResult> {
    const device = await this.deviceRepo.findByDevEuiAndTenantId(input.deveui, input.idTenant);
    if (!input.parameters || Object.keys(input.parameters).length === 0) {
      throw new BadRequestException('parameters must be a non-empty object');
    }
    assertSafeAndSupportedParameters(input.parameters);

    const parts = Object.entries(input.parameters).map(([k, v]) =>
      PARAMETER_HANDLERS[k](this.codec, v),
    );
    const buffer = this.codec.buildConfigureMultiple(parts);

    const remoteCfg = await this.remoteCfgRepo.upsertDesired({
      idTenant: input.idTenant,
      idDevice: device.id,
      desired: input.parameters,
    });

    const result = await this.persistAndEnqueue({
      device,
      idTenant: input.idTenant,
      idUser: input.idUser ?? null,
      idProfile: null,
      type: 'CONFIGURE',
      action: `configure:${Object.keys(input.parameters).join(',')}`,
      fPort: LW001_BG_PRO_DOWNLINK_PORTS.GENERAL_COMMANDS,
      buffer,
      parameters: input.parameters,
      desiredVersion: remoteCfg.desiredVersion,
      initialStatus: 'PENDING_VERIFICATION',
    });

    await this.scheduleVerificationRead(
      device,
      input.idTenant,
      input.idUser ?? null,
      Object.keys(input.parameters),
      null,
      remoteCfg.desiredVersion,
    );
    return result;
  }

  /** Envía un comando de control "Downlink for Position". Sin verificación estricta. */
  async requestPosition(input: {
    deveui: string;
    idTenant: string;
    idUser?: string | null;
  }): Promise<DownlinkOperationResult> {
    return this.sendControlCommand({
      ...input,
      command: 'downlink_position',
    });
  }

  /** Pide al dispositivo que reporte su consumo de batería. */
  async requestBatteryConsumption(input: {
    deveui: string;
    idTenant: string;
    idUser?: string | null;
  }): Promise<DownlinkOperationResult> {
    return this.sendControlCommand({
      ...input,
      command: 'request_battery',
    });
  }

  /** Limpia el estado man-down del dispositivo. */
  async clearManDown(input: {
    deveui: string;
    idTenant: string;
    idUser?: string | null;
  }): Promise<DownlinkOperationResult> {
    return this.sendControlCommand({
      ...input,
      command: 'clear_man_down',
    });
  }

  /**
   * Apaga GPS / WiFi / BT en el collar y deja la posición a cargo del LNS (TDOA/RSSI
   * de los gateways LoRaWAN). Encola **un único** Configure con las 6 position-strategy
   * en `0x00`.
   *
   * Útil en operaciones ganaderas con buena cobertura LoRaWAN: ahorra batería y reduce
   * el tráfico LoRaWAN (no más uplinks Port 2 con MAC/RSSI o lat/lng del device).
   *
   * **Sin** `scheduleVerificationRead` automático: en clase A, encadenar Configure +
   * Read en la misma cola provoca que ChirpStack pierda el segundo downlink. El
   * operador puede pulsar manualmente los Bloques 2A/2B/2C después para confirmar.
   * Aun así el comando queda en `PENDING_VERIFICATION`: cuando el operador haga el
   * Read, `processUplinkForVerification` lo marca como `APPLIED`.
   */
  async setLorawanOnlyPositioning(input: {
    deveui: string;
    idTenant: string;
    idUser?: string | null;
  }): Promise<DownlinkOperationResult> {
    const parameters = { ...LORAWAN_ONLY_POSITIONING_PARAMETERS };
    const device = await this.deviceRepo.findByDevEuiAndTenantId(
      input.deveui,
      input.idTenant,
    );

    const parts = Object.entries(parameters).map(([k, v]) =>
      PARAMETER_HANDLERS[k](this.codec, v),
    );
    const buffer = this.codec.buildConfigureMultiple(parts);

    const remoteCfg = await this.remoteCfgRepo.upsertDesired({
      idTenant: input.idTenant,
      idDevice: device.id,
      desired: parameters,
    });

    return this.persistAndEnqueue({
      device,
      idTenant: input.idTenant,
      idUser: input.idUser ?? null,
      idProfile: null,
      type: 'CONFIGURE',
      action: 'setLorawanOnlyPositioning',
      fPort: LW001_BG_PRO_DOWNLINK_PORTS.GENERAL_COMMANDS,
      buffer,
      parameters,
      desiredVersion: remoteCfg.desiredVersion,
      initialStatus: 'PENDING_VERIFICATION',
    });
  }

  /** Reinicia el dispositivo (reboot). */
  async rebootDevice(input: {
    deveui: string;
    idTenant: string;
    idUser?: string | null;
  }): Promise<DownlinkOperationResult> {
    return this.sendControlCommand({
      ...input,
      command: 'reboot',
    });
  }

  /** Activa transmisión BLE para configuración local. */
  async enableBluetooth(input: {
    deveui: string;
    idTenant: string;
    idUser?: string | null;
  }): Promise<DownlinkOperationResult> {
    return this.sendControlCommand({
      ...input,
      command: 'enable_bluetooth',
    });
  }

  /**
   * Lectura manual de parámetros. Acepta nombres en camelCase. Rechaza dangerous excepto
   * cuando `allowDangerousReads = true` (solo para roles ADMIN).
   */
  async readParameters(input: {
    deveui: string;
    idTenant: string;
    parameterNames: string[];
    idUser?: string | null;
    allowDangerousReads?: boolean;
  }): Promise<DownlinkOperationResult> {
    const device = await this.deviceRepo.findByDevEuiAndTenantId(input.deveui, input.idTenant);
    if (!input.parameterNames?.length) {
      throw new BadRequestException('parameterNames must be a non-empty array');
    }
    const ids: number[] = [];
    for (const name of input.parameterNames) {
      const id = LW001_BG_PRO_PARAM_NAME_TO_ID[name];
      if (id === undefined) {
        throw new BadRequestException(`Unknown parameter name: "${name}"`);
      }
      if (LW001_BG_PRO_DANGEROUS_PARAM_IDS.has(id) && !input.allowDangerousReads) {
        throw new BadRequestException(
          `Parameter "${name}" is dangerous; only ADMIN roles can read it`,
        );
      }
      ids.push(id);
    }
    const buffer = this.codec.buildReadParameters(ids);
    return this.persistAndEnqueue({
      device,
      idTenant: input.idTenant,
      idUser: input.idUser ?? null,
      idProfile: null,
      type: 'READ',
      action: `readParameters:${input.parameterNames.join(',')}`,
      fPort: LW001_BG_PRO_DOWNLINK_PORTS.GENERAL_COMMANDS,
      buffer,
      parameters: { ids: input.parameterNames },
      desiredVersion: null,
      initialStatus: 'PENDING_VERIFICATION',
    });
  }

  /**
   * Encola una o varias tramas Read con todos los IDs de parámetro del PDF
   * que no están en `LW001_BG_PRO_DANGEROUS_PARAM_IDS`. Fragmenta en tramas de hasta
   * `LW001_BG_PRO_READ_PARAMETERS_IDS_PER_DOWNLINK_MAX` IDs por downlink.
   *
   * Para espaciar la carga en el aire o en el firmware del device, usar en su lugar
   * `readSafeParametersChunk` desde la UI (un botón por bloque).
   */
  async readAllSafeParameters(input: {
    deveui: string;
    idTenant: string;
    idUser?: string | null;
  }): Promise<ReadAllSafeParametersResult> {
    const device = await this.deviceRepo.findByDevEuiAndTenantId(input.deveui, input.idTenant);
    const chunks = lw001BgProSafeReadParameterChunks();
    if (chunks.length === 0) {
      throw new BadRequestException('No safe parameter ids to read');
    }
    const safeIds = lw001BgProSafeReadParameterIds();
    const totalChunks = chunks.length;
    const commands: DownlinkOperationResult[] = [];
    for (const chunk of chunks) {
      const buffer = this.codec.buildReadParameters([...chunk.parameterIds]);
      const r = await this.persistAndEnqueue({
        device,
        idTenant: input.idTenant,
        idUser: input.idUser ?? null,
        idProfile: null,
        type: 'READ',
        action: `readAllSafeParameters:${chunk.chunkIndex + 1}/${totalChunks}`,
        fPort: LW001_BG_PRO_DOWNLINK_PORTS.GENERAL_COMMANDS,
        buffer,
        parameters: {
          parameterIds: [...chunk.parameterIds],
          parameterNames: [...chunk.parameterNames],
        },
        desiredVersion: null,
        initialStatus: 'PENDING_VERIFICATION',
      });
      commands.push(r);
    }
    return {
      totalParameterIds: safeIds.length,
      chunksEnqueued: commands.length,
      commands,
    };
  }

  /**
   * Devuelve el plan de bloques de lectura segura (misma partición que `readAllSafeParameters`)
   * sin encolar nada. La UI usa esto para renderizar un botón por bloque.
   */
  async getReadSafeParametersChunkPlan(
    deveui: string,
    idTenant: string,
  ): Promise<ReadSafeParametersChunkPlanResult> {
    await this.deviceRepo.findByDevEuiAndTenantId(deveui, idTenant);
    const chunks = lw001BgProSafeReadParameterChunks();
    const safeIds = lw001BgProSafeReadParameterIds();
    return {
      totalParameterIds: safeIds.length,
      maxPerFrame: LW001_BG_PRO_READ_PARAMETERS_IDS_PER_DOWNLINK_MAX,
      totalChunks: chunks.length,
      chunks: chunks.map((c) => ({
        chunkIndex: c.chunkIndex,
        category: c.category,
        count: c.parameterIds.length,
        parameterIds: [...c.parameterIds],
        parameterNames: [...c.parameterNames],
      })),
    };
  }

  /**
   * Encola **un solo** Read con el bloque `chunkIndex` (0-based) del plan seguro.
   * Útil cuando el firmware no tolera encolar todos los chunks a la vez.
   */
  async readSafeParametersChunk(input: {
    deveui: string;
    idTenant: string;
    idUser?: string | null;
    chunkIndex: number;
  }): Promise<DownlinkOperationResult> {
    const device = await this.deviceRepo.findByDevEuiAndTenantId(input.deveui, input.idTenant);
    const chunks = lw001BgProSafeReadParameterChunks();
    if (chunks.length === 0) {
      throw new BadRequestException('No safe parameter ids to read');
    }
    if (
      !Number.isInteger(input.chunkIndex) ||
      input.chunkIndex < 0 ||
      input.chunkIndex >= chunks.length
    ) {
      throw new BadRequestException(
        `chunkIndex must be an integer in [0, ${chunks.length - 1}], got ${input.chunkIndex}`,
      );
    }
    const chunk = chunks[input.chunkIndex];
    const buffer = this.codec.buildReadParameters([...chunk.parameterIds]);
    return this.persistAndEnqueue({
      device,
      idTenant: input.idTenant,
      idUser: input.idUser ?? null,
      idProfile: null,
      type: 'READ',
      action: `readSafeParametersChunk:${chunk.chunkIndex + 1}/${chunks.length}`,
      fPort: LW001_BG_PRO_DOWNLINK_PORTS.GENERAL_COMMANDS,
      buffer,
      parameters: {
        chunkIndex: chunk.chunkIndex,
        parameterIds: [...chunk.parameterIds],
        parameterNames: [...chunk.parameterNames],
      },
      desiredVersion: null,
      initialStatus: 'PENDING_VERIFICATION',
    });
  }

  /** Comando de Local Storage Data Command (port 11). */
  async localStorageCommand(input: {
    deveui: string;
    idTenant: string;
    command: Lw001BgProLocalStorageInput;
    idUser?: string | null;
  }): Promise<DownlinkOperationResult> {
    const device = await this.deviceRepo.findByDevEuiAndTenantId(input.deveui, input.idTenant);
    const buffer = this.codec.buildLocalStorageCommand(input.command);
    return this.persistAndEnqueue({
      device,
      idTenant: input.idTenant,
      idUser: input.idUser ?? null,
      idProfile: null,
      type: 'LOCAL_STORAGE',
      action: `localStorage:${input.command.action}`,
      fPort: LW001_BG_PRO_DOWNLINK_PORTS.LOCAL_STORAGE_DATA,
      buffer,
      parameters: { ...input.command },
      desiredVersion: null,
      initialStatus: 'QUEUED_IN_CHIRPSTACK',
    });
  }

  /** Estado actual de configuración remota del device. */
  async getStatus(deveui: string, idTenant: string) {
    const device = await this.deviceRepo.findByDevEuiAndTenantId(deveui, idTenant);
    const cfg = await this.remoteCfgRepo.findByDevice(device.id);
    return {
      device: { id: device.id, deveui: device.deveui, name: device.name },
      remoteConfig: cfg,
    };
  }

  // ============================================================
  // Modo diagnóstico (silencia eventos auxiliares + heartbeat 300 s)
  // ============================================================

  /**
   * Activa el modo diagnóstico:
   *
   * 1. Snapshot de los 4 parámetros actuales (de `desired`, fallback a defaults FincaApp).
   * 2. Construye un Configure con `shockDetectionSwitch=false`, `manDownDetectionSwitch=false`,
   *    `tamperAlarmSwitch=false`, `heartbeatInterval=300` y lo encola en ChirpStack.
   * 3. Persiste `diagnostic_state = { active, enabledAt, expiresAt, previous, ... }`.
   *
   * Idempotencia: si ya hay un `diagnostic_state` activo (no expirado), refresca
   * `expiresAt` extendiendo el TTL desde "ahora" sin tocar `previous`.
   */
  async enableDiagnosticMode(input: {
    deveui: string;
    idTenant: string;
    idUser?: string | null;
    ttlMinutes?: number;
  }): Promise<{
    command: DownlinkOperationResult;
    diagnosticState: DeviceDiagnosticState;
  }> {
    const ttlMin = this.resolveDiagnosticTtl(input.ttlMinutes);
    const device = await this.deviceRepo.findByDevEuiAndTenantId(input.deveui, input.idTenant);
    const existing = await this.remoteCfgRepo.findByDevice(device.id);

    // Si ya hay un modo activo, conservar el snapshot original y solo extender TTL.
    const previous: DeviceDiagnosticPreviousValues = existing?.diagnosticState?.previous
      ? existing.diagnosticState.previous
      : this.snapshotDiagnosticParameters(existing?.desired ?? {});

    const command = await this.applyDiagnosticConfigure({
      device,
      idTenant: input.idTenant,
      idUser: input.idUser ?? null,
      parameters: { ...DIAGNOSTIC_MODE_PARAMETERS },
      action: 'diagnosticMode:enable',
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMin * 60_000);
    const diagnosticState: DeviceDiagnosticState = {
      active: true,
      enabledAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      previous,
      enabledByUserId: input.idUser ?? null,
      ttlMinutes: ttlMin,
    };
    await this.remoteCfgRepo.setDiagnosticState(device.id, diagnosticState);
    return { command, diagnosticState };
  }

  /**
   * Desactiva el modo diagnóstico restaurando los 4 parámetros previos vía Configure.
   * Idempotente: si no hay diagnostic_state activo, retorna sin emitir downlinks.
   *
   * `triggeredBy = 'auto'` lo usa el cron interno; `'user'` el endpoint REST.
   */
  async disableDiagnosticMode(input: {
    deveui: string;
    idTenant: string;
    idUser?: string | null;
    triggeredBy?: 'user' | 'auto';
  }): Promise<{
    command: DownlinkOperationResult | null;
    restoredFrom: DeviceDiagnosticState | null;
  }> {
    const device = await this.deviceRepo.findByDevEuiAndTenantId(input.deveui, input.idTenant);
    const existing = await this.remoteCfgRepo.findByDevice(device.id);
    const current = existing?.diagnosticState ?? null;
    if (!current) {
      return { command: null, restoredFrom: null };
    }

    const restoreParams = current.previous ?? DIAGNOSTIC_FALLBACK_RESTORE;
    const command = await this.applyDiagnosticConfigure({
      device,
      idTenant: input.idTenant,
      idUser: input.idUser ?? null,
      parameters: { ...restoreParams },
      action:
        input.triggeredBy === 'auto'
          ? 'diagnosticMode:auto-disable'
          : 'diagnosticMode:disable',
    });

    await this.remoteCfgRepo.setDiagnosticState(device.id, null);
    return { command, restoredFrom: current };
  }

  /**
   * Tick del cron interno: busca devices con `diagnostic_state.expiresAt <= now()`
   * y los restaura. Reusable desde tests (no depende de timers reales).
   */
  async runDiagnosticAutoRestoreOnce(): Promise<{ restored: number }> {
    const now = new Date();
    const expired = await this.remoteCfgRepo.findExpiredDiagnosticModes(now);
    let restored = 0;
    for (const cfg of expired) {
      try {
        const device = await this.findDeviceForAutoRestore(cfg);
        if (!device) continue;
        await this.disableDiagnosticMode({
          deveui: device.deveui,
          idTenant: cfg.idTenant,
          idUser: null,
          triggeredBy: 'auto',
        });
        restored++;
        this.logger.log(
          `Diagnostic mode auto-restored on device ${device.deveui} (idDevice=${cfg.idDevice})`,
        );
      } catch (e) {
        this.logger.error(
          `Diagnostic auto-restore failed for idDevice=${cfg.idDevice}: ${
            (e as Error).message
          }`,
        );
      }
    }
    return { restored };
  }

  /**
   * Llamado por MqttService al recibir un uplink ya parseado.
   *
   * Si el parser identificó respuestas a Read parameters → recorre los pendientes
   * `PENDING_VERIFICATION` del device y marca como APPLIED los parámetros confirmados.
   */
  async processUplinkForVerification(input: {
    idDevice: string;
    parameters: Array<{ id: number; name?: string; valueHex: string }>;
  }): Promise<{ applied: number; commandsUpdated: string[] }> {
    if (!input.parameters?.length) {
      return { applied: 0, commandsUpdated: [] };
    }

    const confirmedDelta: Record<string, unknown> = {};
    for (const p of input.parameters) {
      if (p.name) {
        confirmedDelta[p.name] = p.valueHex;
      }
    }
    const cfg = await this.remoteCfgRepo.applyConfirmedParameters(
      input.idDevice,
      confirmedDelta,
      // confirmedVersion = la versión actual del desired (mejor estimador disponible).
      Number.MAX_SAFE_INTEGER,
    );

    if (!cfg) return { applied: 0, commandsUpdated: [] };

    const pending = await this.downlinkRepo.findLatestPendingVerificationForDevice(input.idDevice);
    const commandsUpdated: string[] = [];

    for (const cmd of pending) {
      if (this.commandMatchesConfirmedParameters(cmd, confirmedDelta)) {
        await this.downlinkRepo.update(cmd.id, {
          status: 'APPLIED',
          verifiedAt: new Date(),
        });
        commandsUpdated.push(cmd.id);
      }
    }

    return { applied: Object.keys(confirmedDelta).length, commandsUpdated };
  }

  // ============================================================
  // Helpers internos
  // ============================================================

  /**
   * Construye y encola un Configure de exactamente los 4 parámetros del modo diagnóstico
   * (en cualquier dirección: enable o disable). Reutiliza `persistAndEnqueue` para
   * registrar el comando en `device_downlink_commands` de forma trazable.
   *
   * También actualiza `desired` en `device_remote_configurations` para que la UI vea
   * inmediatamente lo que se le pidió al device, sin esperar a una confirmación que
   * (por limitaciones de firmware MOKO) probablemente nunca llegará por LoRa.
   */
  private async applyDiagnosticConfigure(input: {
    device: { id: string; deveui: string };
    idTenant: string;
    idUser: string | null;
    parameters: Record<string, unknown>;
    action: string;
  }): Promise<DownlinkOperationResult> {
    assertSafeAndSupportedParameters(input.parameters);
    const parts = Object.entries(input.parameters).map(([k, v]) =>
      PARAMETER_HANDLERS[k](this.codec, v),
    );
    const buffer = this.codec.buildConfigureMultiple(parts);

    const remoteCfg = await this.remoteCfgRepo.upsertDesired({
      idTenant: input.idTenant,
      idDevice: input.device.id,
      desired: input.parameters,
    });

    return this.persistAndEnqueue({
      device: input.device,
      idTenant: input.idTenant,
      idUser: input.idUser,
      idProfile: null,
      type: 'CONFIGURE',
      action: input.action,
      fPort: LW001_BG_PRO_DOWNLINK_PORTS.GENERAL_COMMANDS,
      buffer,
      parameters: input.parameters,
      desiredVersion: remoteCfg.desiredVersion,
      initialStatus: 'QUEUED_IN_CHIRPSTACK',
    });
  }

  /**
   * Toma el snapshot de los 4 parámetros del modo diagnóstico, leyendo de `desired`
   * con fallback a defaults FincaApp seguros (`shock=true`, `manDown=true`,
   * `tamper=true`, `heartbeat=720`).
   */
  private snapshotDiagnosticParameters(
    desired: Record<string, unknown>,
  ): DeviceDiagnosticPreviousValues {
    const pickBool = (key: keyof DeviceDiagnosticPreviousValues, fallback: boolean): boolean => {
      const v = desired[key];
      return typeof v === 'boolean' ? v : fallback;
    };
    const pickNum = (key: keyof DeviceDiagnosticPreviousValues, fallback: number): number => {
      const v = desired[key];
      return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    };
    return {
      shockDetectionSwitch: pickBool(
        'shockDetectionSwitch',
        DIAGNOSTIC_FALLBACK_RESTORE.shockDetectionSwitch,
      ),
      manDownDetectionSwitch: pickBool(
        'manDownDetectionSwitch',
        DIAGNOSTIC_FALLBACK_RESTORE.manDownDetectionSwitch,
      ),
      tamperAlarmSwitch: pickBool(
        'tamperAlarmSwitch',
        DIAGNOSTIC_FALLBACK_RESTORE.tamperAlarmSwitch,
      ),
      heartbeatInterval: pickNum(
        'heartbeatInterval',
        DIAGNOSTIC_FALLBACK_RESTORE.heartbeatInterval,
      ),
    };
  }

  /**
   * Resuelve el TTL del modo diagnóstico aplicando, en orden de precedencia:
   *  1. `ttlMinutes` explícito (validado contra rango).
   *  2. Env var `DIAGNOSTIC_MODE_TTL_MIN`.
   *  3. Default `DIAGNOSTIC_TTL_DEFAULT_MIN` (30 min).
   * Throws BadRequestException si está fuera de rango razonable (5..240).
   */
  private resolveDiagnosticTtl(explicit?: number): number {
    const fromEnv = this.configService?.get<string | number>('DIAGNOSTIC_MODE_TTL_MIN');
    const candidate =
      typeof explicit === 'number' && Number.isFinite(explicit)
        ? explicit
        : typeof fromEnv === 'number' && Number.isFinite(fromEnv)
          ? fromEnv
          : typeof fromEnv === 'string' && Number.isFinite(Number(fromEnv))
            ? Number(fromEnv)
            : DIAGNOSTIC_TTL_DEFAULT_MIN;
    if (
      !Number.isInteger(candidate) ||
      candidate < DIAGNOSTIC_TTL_MIN_MIN ||
      candidate > DIAGNOSTIC_TTL_MAX_MIN
    ) {
      throw new BadRequestException(
        `ttlMinutes must be an integer in [${DIAGNOSTIC_TTL_MIN_MIN}, ${DIAGNOSTIC_TTL_MAX_MIN}], got ${candidate}`,
      );
    }
    return candidate;
  }

  /**
   * Busca el device asociado a una `DeviceRemoteConfiguration` para el cron interno
   * de auto-restauración. Devuelve `null` si el device fue eliminado entre que se
   * activó el modo diagnóstico y el tick del cron.
   */
  private async findDeviceForAutoRestore(
    cfg: DeviceRemoteConfiguration,
  ): Promise<{ id: string; deveui: string } | null> {
    try {
      const device = await this.deviceRepo.findByIdAndTenantId(cfg.idDevice, cfg.idTenant);
      return { id: device.id, deveui: device.deveui };
    } catch {
      return null;
    }
  }

  private async sendControlCommand(input: {
    deveui: string;
    idTenant: string;
    command: Lw001BgProControlCommand;
    idUser?: string | null;
  }): Promise<DownlinkOperationResult> {
    if (!SAFE_CONTROL_COMMANDS.has(input.command)) {
      throw new BadRequestException(
        `Control command "${input.command}" is not allowed via REST endpoints`,
      );
    }
    const device = await this.deviceRepo.findByDevEuiAndTenantId(input.deveui, input.idTenant);
    const buffer = this.codec.buildControlCommand(input.command);
    return this.persistAndEnqueue({
      device,
      idTenant: input.idTenant,
      idUser: input.idUser ?? null,
      idProfile: null,
      type: 'CONTROL',
      action: `control:${input.command}`,
      fPort: LW001_BG_PRO_DOWNLINK_PORTS.GENERAL_COMMANDS,
      buffer,
      parameters: { command: input.command },
      desiredVersion: null,
      initialStatus: 'QUEUED_IN_CHIRPSTACK',
    });
  }

  private async scheduleVerificationRead(
    device: { id: string; deveui: string },
    idTenant: string,
    idUser: string | null,
    parameterNames: string[],
    idProfile: string | null,
    desiredVersion: number,
  ): Promise<void> {
    const ids = parameterNames
      .map((n) => LW001_BG_PRO_PARAM_NAME_TO_ID[n])
      .filter((id): id is number => typeof id === 'number');
    if (ids.length === 0) return;
    try {
      const buffer = this.codec.buildReadParameters(ids);
      await this.persistAndEnqueue({
        device,
        idTenant,
        idUser,
        idProfile,
        type: 'READ',
        action: 'verifyConfiguration',
        fPort: LW001_BG_PRO_DOWNLINK_PORTS.GENERAL_COMMANDS,
        buffer,
        parameters: { ids: parameterNames },
        desiredVersion,
        initialStatus: 'PENDING_VERIFICATION',
      });
    } catch (e) {
      this.logger.warn(
        `Failed to schedule verification read for ${device.deveui}: ${(e as Error).message}`,
      );
    }
  }

  private async persistAndEnqueue(input: {
    device: { id: string; deveui: string };
    idTenant: string;
    idUser: string | null;
    idProfile: string | null;
    type: DeviceDownlinkCommandType;
    action: string;
    fPort: number;
    buffer: Buffer;
    parameters: Record<string, unknown>;
    desiredVersion: number | null;
    initialStatus: DeviceDownlinkCommandStatus;
  }): Promise<DownlinkOperationResult> {
    const payloadHex = this.codec.toHex(input.buffer).replace(/\s+/g, '');
    const payloadBase64 = this.codec.toBase64(input.buffer);
    const verificationDeadline = new Date(Date.now() + this.DEFAULT_VERIFICATION_TTL_MS);

    const command = await this.downlinkRepo.create({
      idTenant: input.idTenant,
      idDevice: input.device.id,
      idUser: input.idUser,
      idProfile: input.idProfile,
      type: input.type,
      action: input.action,
      fPort: input.fPort,
      payloadHex: payloadHex.toUpperCase(),
      payloadBase64,
      confirmed: false,
      parameters: input.parameters,
      status: 'PENDING',
      verificationDeadline,
      desiredVersion: input.desiredVersion,
    });

    try {
      const { queueItemId } = await this.chirpstack.enqueue(input.device.deveui, {
        fPort: input.fPort,
        payloadBase64,
        confirmed: false,
      });
      const updated = await this.downlinkRepo.update(command.id, {
        chirpstackQueueItemId: queueItemId,
        status: input.initialStatus,
        queuedAt: new Date(),
      });
      return { command: updated, payloadHex: updated.payloadHex, queueItemId };
    } catch (e) {
      const err = e as Error;
      await this.downlinkRepo.update(command.id, {
        status: 'FAILED',
        errorMessage: err.message?.slice(0, 600) ?? 'Unknown error',
      });
      throw e;
    }
  }

  private commandMatchesConfirmedParameters(
    command: DeviceDownlinkCommand,
    confirmedDelta: Record<string, unknown>,
  ): boolean {
    if (command.type !== 'CONFIGURE') return false;
    const keys = Object.keys(command.parameters ?? {});
    if (keys.length === 0) return false;
    return keys.every((k) => Object.prototype.hasOwnProperty.call(confirmedDelta, k));
  }
}
