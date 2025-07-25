import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Device } from '../../production-center/entities/device.entity';
import { Purchase } from '../../commerce/entities/purchase.entity';
import { Lot } from '../../commerce/entities/lot.entity';
import { Provider } from '../../commerce/entities/provider.entity';

@Entity('cattle')
export class Cattle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid' })
  idTenant: string;

  @Column({ name: 'id_device', type: 'uuid', nullable: true })
  idDevice: string;

  @OneToOne(() => Device, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_device' })
  device?: Device;

  @Column({ name: 'sys_number', length: 50 })
  sysNumber: string;

  @Column({ length: 50 })
  number: string;


  @Column({ name: 'id_brand', type: 'uuid', nullable: true })
  idBrand: string;

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

  @Column({ name: 'id_purchase', type: 'uuid', nullable: true })
  idPurchase: string;

  @ManyToOne(() => Purchase, (purchase) => purchase.cattle, { nullable: true })
  @JoinColumn({ name: 'id_purchase' })
  purchase?: Purchase;

  @Column({ name: 'id_lot', type: 'uuid', nullable: true })
  idLot: string;

  @Column({ name: 'id_provider', type: 'uuid', nullable: true })
  idProvider: string;

  /** ✅ NUEVOS CAMPOS PARA EVENTOS MASIVOS Y ESTADO ACTUAL */

  /** Último peso registrado */
  @Column({ name: 'last_weight', type: 'numeric', precision: 6, scale: 2, nullable: true })
  lastWeight: number;

  /** Eartag actual */
  @Column({ name: 'eartag', type: 'varchar', length: 50, nullable: true })
  eartag: string;

  /** Si está castrado */
  @Column({ name: 'castrated', type: 'boolean', default: false })
  castrated: boolean;

  /** Fecha de castración (único evento) */
  @Column({ name: 'castration_date', type: 'timestamp', nullable: true })
  castrationDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
