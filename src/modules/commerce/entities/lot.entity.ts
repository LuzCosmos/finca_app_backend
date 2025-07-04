import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  CreateDateColumn, UpdateDateColumn, JoinColumn, OneToMany
} from 'typeorm';
import { Purchase } from './purchase.entity';
import { Cattle } from '../../farm/entities/cattle.entity';

@Entity('lot')
export class Lot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid' })
  idTenant: string;

  @Column({ name: 'lot_number', length: 5 })
  lotNumber: string;

  @Column({ nullable: true })
  originPlace: string;

  @Column()
  cattle_count: number;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  average_weight: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  total_weight: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  price_per_kg: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  total_value: number;

  @Column({ nullable: true })
  age: string;

  @Column({ nullable: true })
  sex: string;

  @Column({ name: 'id_purchase', type: 'uuid' })
  idPurchase: string;
  @ManyToOne(() => Purchase, (purchase) => purchase.lots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_purchase' })
  purchase: Purchase;

  @OneToMany(() => Cattle, (cattle) => cattle.lot)
  cattle: Cattle[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
