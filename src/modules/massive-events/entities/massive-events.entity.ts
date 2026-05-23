import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { SimpleEvent } from './simple-event.entity';

@Entity('massive_events')
export class MassiveEvent {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid' })
  idTenant: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ name: 'event_date', type: 'timestamp' })
  eventDate: Date;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: string;

  /** True si el masivo fue creado para una recepción de compra (listado masivos lo excluye; offline sin tabla recepciones). */
  @Column({ name: 'linked_to_purchase_reception', type: 'boolean', default: false })
  linkedToPurchaseReception: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => SimpleEvent, (simpleEvent) => simpleEvent.massiveEvent)
  simpleEvents: SimpleEvent[];
}
