import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  OneToMany,
} from 'typeorm';
import { Device } from '../../production-center/entities/device.entity';
import { Purchase } from '../../commerce/entities/purchase.entity';
import { CattleColor } from '../enums/cattle-color.enum';
import { CattleCharacteristic } from './cattle-characteristic.entity';
import { CattleGender } from '../enums/cattle-gender.enum';

export enum CattleStatus {
  ACTIVE = 'ACTIVE',
  SOLD = 'SOLD',
  DEAD = 'DEAD',
  LOST = 'LOST',
}


@Entity('cattle')
@Index(['idTenant', 'number'])
@Index(['idTenant', 'status'])
export class Cattle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid' })
  idTenant: string;

  @Column({ name: 'sys_number', length: 50 })
  sysNumber: string;

  @Column({ length: 50 })
  number: string;

  @Column({ name: 'received_at', type: 'date' })
  receivedAt: Date;

  @Column({ name: 'received_weight', type: 'numeric', precision: 6, scale: 2 })
  receivedWeight: number;

  @Column({ name: 'id_purchase', type: 'uuid', nullable: true })
  idPurchase: string;

  @ManyToOne(() => Purchase, (purchase) => purchase.cattle, { nullable: true })
  @JoinColumn({ name: 'id_purchase' })
  purchase?: Purchase;

  @Column({ name: 'purchase_weight', type: 'numeric', precision: 6, scale: 2 })
  purchaseWeight: number;

  @Column({ name: 'purchase_price', type: 'numeric', precision: 10, scale: 2 })
  purchasePrice: number;

  @Column({ name: 'id_lot', type: 'uuid', nullable: true })
  idLot: string | null;

  @Column({ name: 'id_brand', type: 'uuid', nullable: true })
  idBrand: string | null;

  @Column({
    type: 'enum',
    enum: CattleColor,
    enumName: 'colors_enum',
    default: CattleColor.WHITE,
  })
  color: CattleColor;

  @OneToMany(() => CattleCharacteristic, (cattleCharacteristic) => cattleCharacteristic.cattle)
  cattleCharacteristics: CattleCharacteristic[];

  /** Arete izquierdo */
  @Column({ name: 'eartag_left', type: 'varchar', length: 50, nullable: true })
  eartagLeft: string | null;

  /** Arete derecho */
  @Column({ name: 'eartag_right', type: 'varchar', length: 50, nullable: true })
  eartagRight: string | null;

  @Column({ name: 'id_device', type: 'uuid', nullable: true })
  idDevice: string | null;

  @OneToOne(() => Device, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_device' })
  device?: Device;

  /** Si está castrado */
  @Column({ name: 'castrated', type: 'boolean', default: false })
  castrated: boolean;

  /** Fecha de castración (único evento) */
  @Column({ name: 'castration_date', type: 'timestamp', nullable: true })
  castrationDate: Date;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

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

  @Column({ name: 'purchased_from', length: 100 })
  purchasedFrom: string;

  @Column({ name: 'id_provider', type: 'uuid', nullable: true })
  idProvider: string;

  /** Último peso registrado */
  @Column({ name: 'last_weight', type: 'numeric', precision: 6, scale: 2, nullable: true })
  lastWeight: number;

  @Column({ name: 'has_horns', type: 'boolean', default: false })
  hasHorn: boolean;

  @Column({
    type: 'enum',
    enum: CattleStatus,
    enumName: 'cattle_status_enum',
    default: CattleStatus.ACTIVE,
  })
  status: CattleStatus;

  @Column({
    type: 'enum',
    enum: CattleGender,
    enumName: 'gender_enum',
  })
  gender: CattleGender;

  @Column({ name: 'birth_date_aprx', type: 'date', nullable: true })
  birthDateAprx: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
