import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  CreateDateColumn, UpdateDateColumn, JoinColumn, Index,
} from 'typeorm';
import { Tenant } from '../../employee-management/entities/tenant.entity';

@Entity({ name: 'colors' })
@Index('ix_colors_tenant', ['idTenant'])
@Index('ix_colors_tenant_active', ['idTenant', 'isActive'])
export class Color {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_tenant' })
  idTenant: Tenant;

  @Column({ type: 'varchar', length: 50 })
  name: string; // La unicidad CI (lower(name)) está en la MIGRACIÓN

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
