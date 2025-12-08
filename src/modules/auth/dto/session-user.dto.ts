import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export class SessionUserDto  {
  username: string;
  sub: string;
  tenant_id:string
  date: string;
  permissionsHash: string;
  permissions: Record<string, Record<string, string>>;
} 