import {
  Entity,
  PrimaryColumn,
  Column,
} from 'typeorm';

@Entity('brands')
export class Brand {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  idTenant: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl?: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'now()' })
  updatedAt: Date;
}
