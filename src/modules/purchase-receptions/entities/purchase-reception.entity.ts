import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'purchase_receptions' })
@Index('ix_purchase_receptions_tenant_purchase', ['idTenant', 'idPurchase'])
export class PurchaseReception {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'id_tenant' })
  idTenant!: string;

  @Column('uuid', { name: 'id_purchase' })
  idPurchase!: string;

  @Column('uuid', { name: 'id_massive_event' })
  idMassiveEvent!: string;

  @Column('timestamp', { name: 'received_at', default: () => 'now()' })
  receivedAt!: Date;

  /*@Column('text', { nullable: true })
  note?: string;*/
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
