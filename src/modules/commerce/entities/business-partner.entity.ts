import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IsNotEmpty } from 'class-validator';
import { Contact } from './contact.entity';

export enum BusinessPartnerRole {
  BUYER = 'BUYER',
  TRANSPORTER = 'TRANSPORTER',
  VET = 'VET',
  OTHER = 'OTHER',
  PROVIDER = 'PROVIDER',
}

@Unique(['nit', 'idTenant'])
@Entity('business_partners')
export class BusinessPartner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'id_tenant', type: 'uuid' })
  idTenant: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 20, nullable: false })
  @IsNotEmpty()
  nit: string;

  @Column({
    type: 'enum',
    enum: BusinessPartnerRole,
    enumName: 'business_partner_roles_enum',
    default: BusinessPartnerRole.OTHER,
  })
  type: BusinessPartnerRole;

  @Column({ length: 255, nullable: true })
  address: string;

  @Column({ name: 'contact_person_id', type: 'uuid', nullable: true })
  contactPersonId: string;

  @ManyToOne(() => Contact, { nullable: true })
  @JoinColumn({ name: 'contact_person_id' })
  contactPerson: Contact;

  @Column({ name: 'extra_config', type: 'jsonb', nullable: true })
  extraConfig: { sales?: { minWeightKg: number } } | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
