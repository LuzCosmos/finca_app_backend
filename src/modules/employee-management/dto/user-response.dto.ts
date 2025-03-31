import { Exclude, Expose } from 'class-transformer';
import { Role } from '../entities/role.entity';
import { Tenant } from '../entities/tenant.entity';

@Exclude()
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  email: string;

  @Expose()
  idTenant: string;

  @Expose()
  tenant: Tenant;

  @Expose()
  roles: Role[];

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
} 