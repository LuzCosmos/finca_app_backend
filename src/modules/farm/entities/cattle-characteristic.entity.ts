import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Unique, Column } from 'typeorm';
import { Tenant } from '../../employee-management/entities/tenant.entity';
import { Cattle } from './cattle.entity';
import { Characteristic } from '../../farm/entities/characteristic.entity';

@Entity({ name: 'cattle_characteristics' })
@Unique('ux_cattle_characteristics_unique', ['cattle', 'characteristic'])
export class CattleCharacteristic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_tenant' })
  idTenant: Tenant;

  @ManyToOne(() => Cattle, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cattle' })
  cattle: Cattle;

  @ManyToOne(() => Characteristic, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_characteristic' })
  characteristic: Characteristic;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
