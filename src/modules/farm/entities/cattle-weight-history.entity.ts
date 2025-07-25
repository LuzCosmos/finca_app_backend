import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('cattle_weight_history')
export class CattleWeightHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid' })
  idTenant: string;

  @Column({ name: 'id_cattle', type: 'uuid' })
  idCattle: string;

  @Column({ type: 'numeric', precision: 6, scale: 2 })
  weight: number;

  @Column({ type: 'timestamp' })
  date: Date;

  @Column({ name: 'recorded_in_massive_event', type: 'uuid', nullable: true })
  recordedInMassiveEvent?: string;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy?: string;
}
