import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Cattle } from './cattle.entity';
import { Device } from 'src/modules/production-center/entities/device.entity';

@Entity('cattle_device_assignments')
export class CattleDeviceAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;
/*
  @ManyToOne(() => Cattle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cattle' })
  cattle: Cattle;*/

  @Column({ name: 'id_cattle', type: 'uuid' })
  idCattle: string;
/*
  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_device' })
  device: Device;*/

  @Column({ name: 'id_device', type: 'uuid' })
  idDevice: string;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamp' ,nullable: false})
  assignedAt: Date;

  @Column({ name: 'unassigned_at', type: 'timestamp', nullable: true })
  unassignedAt?: Date;
}
