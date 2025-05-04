import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Device } from '../../production-center/entities/device.entity';


@Entity('cattle')
export class Cattle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid' })
  idTenant: string;

  @Column({ name: 'id_device', type: 'uuid' })
  idDevice: string;

  @OneToOne(() => Device, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_device' })
  device?: Device;  

  @Column({ name: 'sys_number', length: 50 })
  sysNumber: string;

  @Column({ length: 50 })
  number: string;

  @Column({ length: 50, nullable: true })
  brand: string;

  @Column({ name: 'color_description', length: 100, nullable: true })
  colorDescription: string;

  @Column({ name: 'color_main', length: 25, nullable: true })
  colorMain: string;

  @Column({ name: 'color_feature', length: 25, nullable: true })
  colorFeature: string;

  @Column({ length: 10, nullable: true })
  lot: string;

  @Column({ name: 'received_at', type: 'date' })
  receivedAt: Date;

  @Column({ name: 'received_weight', type: 'numeric', precision: 6, scale: 2 })
  receivedWeight: number;

  @Column({ name: 'purchase_weight', type: 'numeric', precision: 6, scale: 2 })
  purchaseWeight: number;

  @Column({ type: 'text', nullable: true })
  comments: string;

  @Column({ name: 'purchased_from', length: 100 })
  purchasedFrom: string;

  @Column({ name: 'purchase_price', type: 'numeric', precision: 10, scale: 2 })
  purchasePrice: number;

  @Column({ name: 'purchase_commission', type: 'numeric', precision: 10, scale: 2, nullable: true })
  purchaseCommission: number;

  @Column({ name: 'negotiated_price_per_kg', type: 'numeric', precision: 10, scale: 2, nullable: true })
  negotiatedPricePerKg: number;

  @Column({ name: 'lot_price_per_weight', type: 'numeric', precision: 10, scale: 2, nullable: true })
  lotPricePerWeight: number;

  @Column({ name: 'sale_price', type: 'numeric', precision: 10, scale: 2, nullable: true })
  salePrice: number;

  @Column({ name: 'sale_price_per_kg', type: 'numeric', precision: 10, scale: 2, nullable: true })
  salePricePerKg: number;   

  @Column({ name: 'sale_weight', type: 'numeric', precision: 6, scale: 2, nullable: true })
  saleWeight: number;

  @Column({ name: 'average_gr', type: 'numeric', precision: 6, scale: 2, nullable: true })
  averageGr: number;
  

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
