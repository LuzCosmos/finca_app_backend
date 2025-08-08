import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('animal_simple_event')
export class AnimalSimpleEvent {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid' })
  idTenant: string;

  @Column({ name: 'id_simple_event', type: 'uuid' })
  idSimpleEvent: string;

  @Column({ name: 'id_massive_event', type: 'uuid' })
  idMassiveEvent: string;

  @Column({ name: 'id_animal', type: 'uuid', nullable: true })
  idAnimal?: string;

  @Column({ name: 'provisional_number', type: 'varchar', length: 50, nullable: true })
  provisionalNumber?: string;

  @Column({ name: 'data', type: 'jsonb', nullable: true })
  data?: any;

  @CreateDateColumn({ name: 'applied_at', type: 'timestamp' })
  appliedAt: Date;

  @Column({ name: 'applied_by', type: 'uuid', nullable: true })
  appliedBy?: string;
}
