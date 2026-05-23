import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      const reason =
        (info && typeof info === 'object' && 'message' in info && (info as Error).message) ||
        (err instanceof Error ? err.message : undefined);
      const kind =
        info && typeof info === 'object' && 'name' in info ? String((info as { name?: string }).name) : undefined;
      this.logger.warn(
        `JWT authentication failed${kind ? ` (${kind})` : ''}${reason ? `: ${reason}` : ''}`,
      );
      throw err || new UnauthorizedException();
    }
    return user;
  }
} 