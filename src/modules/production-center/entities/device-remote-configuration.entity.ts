import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Device } from './device.entity';
import { DeviceConfigurationProfile } from './device-configuration-profile.entity';

/**
 * Estructura persistida en `diagnostic_state` cuando el modo diagnóstico está activo.
 *
 * `previous` guarda los 4 parámetros que se pisaron para poder revertir tal cual.
 * `expiresAt` permite que un cron interno restaure automáticamente sin intervención
 * humana (TTL configurable vía `DIAGNOSTIC_MODE_TTL_MIN`, default 30).
 */
export interface DeviceDiagnosticPreviousValues {
  shockDetectionSwitch: boolean;
  manDownDetectionSwitch: boolean;
  tamperAlarmSwitch: boolean;
  heartbeatInterval: number;
}

export interface DeviceDiagnosticState {
  active: true;
  enabledAt: string;
  expiresAt: string;
  previous: DeviceDiagnosticPreviousValues;
  enabledByUserId: string | null;
  ttlMinutes: number;
}

/**
 * Estado actual de configuración remota por device.
 *
 * Mantiene un único registro vigente por (id_tenant, id_device). Cada vez que se aplica un
 * perfil o se cambia un parámetro, se actualiza `desired` y `desiredVersion`. Cuando llega
 * un uplink de lectura confirmatorio, se actualiza `confirmed` y `confirmedAt`.
 *
 * - `desired` = lo que se le envió al collar.
 * - `confirmed` = lo que el collar reportó haber configurado.
 * - `divergent` = parámetros donde `desired[k] !== confirmed[k]`.
 */
@Entity('device_remote_configurations')
@Index('uq_device_remote_cfg_device', ['idDevice'], { unique: true })
export class DeviceRemoteConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid', nullable: false })
  idTenant: string;

  @Column({ name: 'id_device', type: 'uuid', nullable: false })
  idDevice: string;

  @Column({ name: 'id_profile', type: 'uuid', nullable: true })
  idProfile: string | null;

  /** Snapshot del perfil aplicado (nombre + code + parámetros). */
  @Column({ name: 'profile_snapshot', type: 'jsonb', nullable: true })
  profileSnapshot: Record<string, unknown> | null;

  /** Lo que se quiere que el collar tenga configurado. */
  @Column({ type: 'jsonb', default: {} })
  desired: Record<string, unknown>;

  /** Lo último que el collar reportó haber configurado (lectura). */
  @Column({ type: 'jsonb', default: {} })
  confirmed: Record<string, unknown>;

  /** Lista de parámetros desincronizados (claves camelCase). */
  @Column({ type: 'jsonb', default: [] })
  divergent: string[];

  /**
   * Versión monotónica que se incrementa con cada cambio en `desired`. Se usa para detectar
   * uplinks "viejos" que confirman un estado anterior y descartarlos.
   */
  @Column({ name: 'desired_version', type: 'int', nullable: false, default: 0 })
  desiredVersion: number;

  /** Versión que el último uplink confirmó. Si < desiredVersion → SYNCING. */
  @Column({ name: 'confirmed_version', type: 'int', nullable: false, default: 0 })
  confirmedVersion: number;

  @Column({ name: 'last_pushed_at', type: 'timestamp', nullable: true })
  lastPushedAt: Date | null;

  @Column({ name: 'last_confirmed_at', type: 'timestamp', nullable: true })
  lastConfirmedAt: Date | null;

  /**
   * Estado del modo diagnóstico temporal. `null` cuando está inactivo.
   * Ver migración `1710000000027-AddDiagnosticStateToRemoteConfig` para la estructura.
   */
  @Column({ name: 'diagnostic_state', type: 'jsonb', nullable: true })
  diagnosticState: DeviceDiagnosticState | null;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: false })
  updatedAt: Date;

  @ManyToOne(() => Device)
  @JoinColumn({ name: 'id_device' })
  device?: Device;

  @ManyToOne(() => DeviceConfigurationProfile)
  @JoinColumn({ name: 'id_profile' })
  profile?: DeviceConfigurationProfile;
}
