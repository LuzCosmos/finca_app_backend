import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  CreateDateColumn, UpdateDateColumn, JoinColumn, Index,
} from 'typeorm';
import { Tenant } from '../../employee-management/entities/tenant.entity';

@Entity({ name: 'characteristics' })
@Index('ix_characteristics_tenant', ['idTenant'])
@Index('ix_characteristics_tenant_active', ['idTenant', 'isActive'])
export class Characteristic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_tenant' })
  idTenant: Tenant;

  @Column({ type: 'varchar', length: 100 })
  name: string; // Unicidad CI (lower(name)) en la MIGRACIÓN

  @Column({ name: 'group_name', type: 'varchar', length: 50, nullable: true })
  groupName?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
