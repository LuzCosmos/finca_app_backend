import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from './role.entity';
import { ModuleEntity } from './module.entity';
import { Tenant } from './tenant.entity';

@Entity('role_model_permissions')
export class RoleModulePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'id_role' })
  id_role: string;

  @Column({ name: 'id_module' })
  id_module: string;

  @Column({ name: 'tenant_id' })
  tenant_id: string;

  @Column({ name: 'can_create', default: false })
  can_create: boolean;

  @Column({ name: 'can_read', default: false })
  can_read: boolean;

  @Column({ name: 'can_update', default: false })
  can_update: boolean;

  @Column({ name: 'can_delete', default: false })
  can_delete: boolean;

  @ManyToOne(() => Role, role => role.permissions)
  @JoinColumn({ name: 'id_role' })
  role: Role;

  @ManyToOne(() => ModuleEntity)
  @JoinColumn({ name: 'id_module' })
  module: ModuleEntity;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}