import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150, nullable: true })
  name: string;

  @Column({ length: 50, unique: true, nullable: false })
  company_username: string;

  @Column({ default: true, nullable: true })
  status: boolean;

  @OneToMany(() => User, user => user.tenant)
  users: User[];
} 