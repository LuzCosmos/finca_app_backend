import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Perfil de operación remota MOKO LW001-BG PRO.
 *
 * - Si `id_tenant IS NULL` → perfil **global del sistema** (AHORRO_BATERIA, NORMAL_1H,
 *   SEGUIMIENTO_30MIN, MOVIMIENTO_1H, ALERTA_ROBO). Solo lectura para tenants.
 * - Si `id_tenant` está presente → perfil **personalizado por tenant**, editable por
 *   admins del tenant dentro de los validadores de seguridad.
 *
 * `parameters` es un objeto plano con claves humanas (camelCase) y valores ya validados.
 * Ej: `{ workingMode: 'periodic', heartbeatInterval: 1440, periodicReportInterval: 3600 }`
 */
@Entity('device_configuration_profiles')
@Index('uq_device_cfg_profile_tenant_code', ['idTenant', 'code'], { unique: true })
export class DeviceConfigurationProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** NULL para perfiles globales del sistema. */
  @Column({ name: 'id_tenant', type: 'uuid', nullable: true })
  idTenant: string | null;

  @Column({ type: 'varchar', length: 50, nullable: false })
  code: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  /**
   * Parámetros con sus valores ya normalizados.
   * Las claves son nombres camelCase del codec (`workingMode`, `heartbeatInterval`, ...).
   */
  @Column({ type: 'jsonb', default: {} })
  parameters: Record<string, unknown>;

  /** Si true → no se puede editar ni eliminar (perfiles globales). */
  @Column({ name: 'is_system', type: 'boolean', default: false, nullable: false })
  isSystem: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true, nullable: false })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: false })
  updatedAt: Date;
}
