import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../employee-management/services/users.service';
import { User } from '../../employee-management/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, tenantId: string, password: string): Promise<any> {
    const user = await this.usersService.validateUser(username, tenantId, password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }

  async login(user: User) {
    const payload = {
      username: user.username,
      sub: user.id,
      tenant_id: user.idTenant,
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
        tenant_id: user.idTenant,
        roles: user.roles
      }
    };
  }
} 