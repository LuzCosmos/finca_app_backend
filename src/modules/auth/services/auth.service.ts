import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../employee-management/services/users.service';
import { User } from '../../employee-management/entities/user.entity';
import { TenantsService } from '../../employee-management/services/tenants.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private tenantsService: TenantsService,
  ) {}

  async validateUser(username: string, company_username: string, password: string): Promise<any> {
    // Buscar el tenant por company_username
    const tenant = await this.tenantsService.findByCompanyUsername(company_username);
    if (!tenant) {
      throw new UnauthorizedException('Compañía no encontrada');
    }

    // Validar el usuario con el tenantId encontrado
    const user = await this.usersService.validateUser(username, password, tenant.id);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }

  async login(user: User) {
    const payload = {
      username: user.username,
      sub: user.id,
      tenant_id: user.tenantId,
      roles: user.roles.map(role => ({
        id: role.id,
        name: role.name
      }))
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        tenant_id: user.tenantId,
        roles: user.roles
      }
    };
  }
} 