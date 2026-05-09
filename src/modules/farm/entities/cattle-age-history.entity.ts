import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BirthDateAprxSource } from '../enums/birth-date-aprx-source.enum';
import { Cattle } from './cattle.entity';

@Entity('cattle_age_history')
export class CattleAgeHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid' })
  idTenant: string;

  @Column({ name: 'id_cattle', type: 'uuid' })
  idCattle: string;

  @ManyToOne(() => Cattle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cattle' })
  cattle?: Cattle;

  @Column({
    type: 'enum',
    enum: BirthDateAprxSource,
    enumName: 'birth_date_aprx_source_enum',
  })
  source: BirthDateAprxSource;

  @Column({ name: 'milk_teeth_count', type: 'int', nullable: true })
  milkTeethCount: number | null;

  @Column({ name: 'permanent_teeth_count', type: 'int', nullable: true })
  permanentTeethCount: number | null;

  @Column({ name: 'milk_wear', type: 'smallint', nullable: true })
  milkWear: number | null;

  @Column({ name: 'permanent_wear', type: 'smallint', nullable: true })
  permanentWear: number | null;

  @Column({ name: 'dental_evaluation_date', type: 'date', nullable: true })
  dentalEvaluationDate: Date | null;

  @Column({ name: 'birth_date_aprx_result', type: 'date', nullable: true })
  birthDateAprxResult: Date | null;

  @Column({ name: 'dentition_table_version', type: 'varchar', length: 32, nullable: true })
  dentitionTableVersion: string | null;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
