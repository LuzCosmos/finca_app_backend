import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { SimpleEventType } from '../enums/simple-event-type.enum';

@Entity('simple_events')
export class SimpleEvent {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid' })
  idTenant: string;

  @Column({ name: 'id_massive_event', type: 'uuid' })
  idMassiveEvent: string;

  @Column({name: 'type', type: 'enum', enum: SimpleEventType, enumName: 'simple_event_type_enum' })
  type: SimpleEventType; // medication, weight, castration, brand, tracker, eartag

  @Column({ type: 'jsonb', nullable: true })
  data?: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
