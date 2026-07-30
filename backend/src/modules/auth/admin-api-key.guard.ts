import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Simple admin gate via `x-admin-api-key` header matching ADMIN_API_KEY. */
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('admin.apiKey');
    if (!expected) {
      throw new UnauthorizedException({
        code: 'admin_not_configured',
        message: 'ADMIN_API_KEY is not set on the server',
      });
    }
    const req = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const raw = req.headers?.['x-admin-api-key'];
    const key = Array.isArray(raw) ? raw[0] : raw;
    if (!key || key !== expected) {
      throw new UnauthorizedException({
        code: 'unauthorized',
        message: 'Invalid admin API key',
      });
    }
    return true;
  }
}
