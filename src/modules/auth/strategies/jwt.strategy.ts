import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../employee-management/services/users.service';
import { ApplicationPermissionsService } from '../application-permissions/application-permissions.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private permissionsService: ApplicationPermissionsService
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET no está configurado en las variables de entorno');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException();
    }
    // Retrieve the session data from Redis
    const sessionData = await this.permissionsService.getSessionFromRedis(payload.sub);
    if (!sessionData) {
      throw new UnauthorizedException('Session expired or invalid.');
    }
    // Validate that the permissions hash matches
    if (sessionData.permissionsHash !== payload.permissionsHash) {
      throw new UnauthorizedException('Permissions outdated. Please refresh your session.');
    }
    // Return the session data (or customize as needed)
    //authomatic asssing sessionData to request.user
    return sessionData;
  }
} 