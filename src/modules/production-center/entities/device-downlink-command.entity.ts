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

/**
 * Estados del ciclo de vida de un downlink.
 *
 *  PENDING               → creado en BD, todavía no enviado a ChirpStack.
 *  QUEUED_IN_CHIRPSTACK  → ChirpStack aceptó el enqueue.
 *  SENT                  → ChirpStack reportó TxAck (downlink salió por la pasarela).
 *  ACKED                 → solo si confirmed=true y dispositivo respondió ACK LoRaWAN.
 *  PENDING_VERIFICATION  → comando de configuración aplicado pero sin lectura confirmatoria.
 *  APPLIED               → uplink de lectura confirmó el valor configurado (ESTRICTO).
 *  FAILED                → ChirpStack devolvió error o se canceló.
 *  EXPIRED               → no llegó verificación dentro del TTL configurado.
 */
export type DeviceDownlinkCommandStatus =
  | 'PENDING'
  | 'QUEUED_IN_CHIRPSTACK'
  | 'SENT'
  | 'ACKED'
  | 'PENDING_VERIFICATION'
  | 'APPLIED'
  | 'FAILED'
  | 'EXPIRED';

/** Tipo de operación. Coincide con el byte 0 (CMD) del payload MOKO. */
export type DeviceDownlinkCommandType =
  | 'CONTROL'
  | 'READ'
  | 'CONFIGURE'
  | 'LOCAL_STORAGE';

@Entity('device_downlink_commands')
@Index('idx_dl_cmd_device_status', ['idDevice', 'status'])
@Index('idx_dl_cmd_tenant_created', ['idTenant', 'createdAt'])
@Index('idx_dl_cmd_queue_item', ['chirpstackQueueItemId'])
export class DeviceDownlinkCommand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid', nullable: false })
  idTenant: string;

  @Column({ name: 'id_device', type: 'uuid', nullable: false })
  idDevice: string;

  @Column({ name: 'id_user', type: 'uuid', nullable: true })
  idUser: string | null;

  /** Si el comando es parte de "applyProfile", referencia al snapshot. */
  @Column({ name: 'id_profile', type: 'uuid', nullable: true })
  idProfile: string | null;

  @Column({ type: 'varchar', length: 30, nullable: false })
  type: DeviceDownlinkCommandType;

  /** Subtipo legible del comando (REBOOT, REQUEST_BATTERY, applyProfile, configure, ...). */
  @Column({ type: 'varchar', length: 80, nullable: false })
  action: string;

  /** Puerto LoRaWAN (10 = general, 11 = local storage). */
  @Column({ name: 'f_port', type: 'smallint', nullable: false })
  fPort: number;

  /** Payload HEX exacto (mayúsculas, sin espacios). */
  @Column({ name: 'payload_hex', type: 'varchar', length: 600, nullable: false })
  payloadHex: string;

  /** Payload base64 enviado a ChirpStack. */
  @Column({ name: 'payload_base64', type: 'varchar', length: 800, nullable: false })
  payloadBase64: string;

  /** Si se solicitó ACK LoRaWAN. */
  @Column({ type: 'boolean', default: false, nullable: false })
  confirmed: boolean;

  /** Parámetros del codec en forma legible (para auditoría). */
  @Column({ type: 'jsonb', default: {} })
  parameters: Record<string, unknown>;

  /** UUID asignado por ChirpStack al item de la cola. */
  @Column({ name: 'chirpstack_queue_item_id', type: 'varchar', length: 64, nullable: true })
  chirpstackQueueItemId: string | null;

  @Column({ type: 'varchar', length: 30, nullable: false, default: 'PENDING' })
  status: DeviceDownlinkCommandStatus;

  /** Si status=FAILED, descripción del error. */
  @Column({ name: 'error_message', type: 'varchar', length: 600, nullable: true })
  errorMessage: string | null;

  @Column({ name: 'queued_at', type: 'timestamp', nullable: true })
  queuedAt: Date | null;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  /** TTL para verificación; default = ahora + 24h. */
  @Column({ name: 'verification_deadline', type: 'timestamp', nullable: true })
  verificationDeadline: Date | null;

  /** Versión de configuración a la que pertenece este comando (para correlación con uplinks). */
  @Column({ name: 'desired_version', type: 'int', nullable: true })
  desiredVersion: number | null;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: false })
  updatedAt: Date;

  @ManyToOne(() => Device)
  @JoinColumn({ name: 'id_device' })
  device?: Device;
}
