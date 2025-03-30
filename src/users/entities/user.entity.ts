import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Role } from './role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, tenant => tenant.users)
  @JoinColumn({ name: 'id_tenant' })
  tenant: Tenant;

  @Column({ name: 'id_tenant', nullable: true })
  id_tenant: string;

  @Column({ length: 50, nullable: false })
  username: string;

  @ManyToOne(() => Role, role => role.users)
  @JoinColumn({ name: 'id_role' })
  role: Role;

  @Column({ name: 'id_role', nullable: true })
  id_role: string;

  @Column({ name: 'first_name', length: 50, nullable: true })
  first_name: string;

  @Column({ name: 'last_name', length: 50, nullable: true })
  last_name: string;

  @Column({ name: 'pass_word', length: 60, select: false, nullable: false })
  pass_word: string;

  @Column({ length: 150, nullable: false })
  email: string;
} 