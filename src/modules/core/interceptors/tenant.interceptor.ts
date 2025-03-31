import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;

    if (tenantId) {
      request.body = {
        ...request.body,
        tenantId,
      };
    }

    return next.handle().pipe(
      map(data => {
        if (Array.isArray(data)) {
          return data.map(item => ({
            ...item,
            tenantId,
          }));
        }
        return {
          ...data,
          tenantId,
        };
      }),
    );
  }
} 