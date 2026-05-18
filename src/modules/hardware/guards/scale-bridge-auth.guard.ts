import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ScaleBridgeAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = this.configService.get<string>('SCALE_BRIDGE_AUTH_TOKEN');
    if (!expected || expected.trim() === '') {
      throw new UnauthorizedException('Scale bridge authentication is not configured');
    }
    const provided =
      request.header('x-scale-bridge-token') ??
      request.header('X-Scale-Bridge-Token');
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid scale bridge token');
    }
    return true;
  }
}
