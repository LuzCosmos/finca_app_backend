import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { IsNotEmpty } from 'class-validator';

@Unique(['nit', 'idTenant'])
@Entity('provider')
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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

}
