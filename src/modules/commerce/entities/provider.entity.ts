import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { IsNotEmpty } from 'class-validator';

export enum ProviderType {
  BUYER = 'BUYER',
  TRANSPORTER = 'TRANSPORTER',
  VET = 'VET',
  OTHER = 'OTHER',
}

@Unique(['nit', 'idTenant'])
@Entity('providers')
export class Provider {
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
    enum: ProviderType,
    default: ProviderType.OTHER,
  })
  type: ProviderType;

  @Column({ length: 255, nullable: true })
  address: string;

  @Column({ length: 50, nullable: true })
  phone: string;

  @Column({ length: 150, nullable: true })
  email: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

}
