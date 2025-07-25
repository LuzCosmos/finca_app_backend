import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('simple_events')
export class SimpleEvent {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid' })
  idTenant: string;

  @Column({ name: 'id_massive_event', type: 'uuid' })
  idMassiveEvent: string;

  @Column({ type: 'varchar', length: 30 })
  type: string; // medication, weight, castration, brand, tracker, eartag

  @Column({ type: 'jsonb', nullable: true })
  data?: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
