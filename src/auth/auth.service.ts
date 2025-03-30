import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    // Aquí deberías implementar la lógica de verificación de credenciales
    // Por ahora, solo generamos un token para demostración
    const payload = { 
      sub: 'user_id', // Aquí iría el ID real del usuario
      username: loginDto.username,
      roles: ['user'] // Aquí irían los roles reales del usuario
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async validateToken(token: string) {
    try {
      return await this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }
} 