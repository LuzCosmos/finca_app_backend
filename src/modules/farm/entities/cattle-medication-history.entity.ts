import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('cattle_medication_history')
export class CattleMedicationHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid' })
  idTenant: string;

  @Column({ name: 'id_cattle', type: 'uuid' })
  idCattle: string;

  @Column({ name: 'medication_name', type: 'varchar', length: 100 })
  medicationName: string;

  @Column({ type: 'varchar', length: 50 })
  route: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'varchar', length: 10 })
  units: string;

  @Column({ name: 'dosage', type: 'varchar', length: 50, nullable: true })
  dosage?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  lot?: string;

  @Column({ type: 'timestamp' })
  date: Date;

  @Column({ name: 'recorded_in_massive_event', type: 'uuid', nullable: true })
  recordedInMassiveEvent?: string;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy?: string;
}
