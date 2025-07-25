import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('simple_event_cattle')
export class SimpleEventCattle {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid' })
  idTenant: string;

  @Column({ name: 'id_simple_event', type: 'uuid' })
  idSimpleEvent: string;

  @Column({ name: 'id_cattle', type: 'uuid', nullable: true })
  idCattle?: string;

  @Column({ name: 'provisional_number', type: 'varchar', length: 50, nullable: true })
  provisionalNumber?: string;

  @CreateDateColumn({ name: 'applied_at', type: 'timestamp' })
  appliedAt: Date;

  @Column({ name: 'applied_by', type: 'uuid', nullable: true })
  appliedBy?: string;
}
