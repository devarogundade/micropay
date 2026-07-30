import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { UsageService } from '../../modules/usage/usage.service';

/**
 * Records API usage for authenticated (wallet) requests.
 * Attaches dimensions: user/wallet, endpoint, method, status, network.
 */
@Injectable()
export class UsageTrackingInterceptor implements NestInterceptor {
  constructor(private readonly usage: UsageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
      headers?: Record<string, string | string[] | undefined>;
      query?: Record<string, unknown>;
      walletAddress?: string;
    }>();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = http.getResponse<{ statusCode?: number }>();
          void this.usage.recordApiHit({
            walletAddress: this.extractWallet(req),
            method: req.method ?? 'GET',
            endpoint: req.originalUrl ?? req.url ?? '',
            statusCode: res.statusCode ?? 200,
            durationMs: Date.now() - started,
          });
        },
        error: () => {
          const res = http.getResponse<{ statusCode?: number }>();
          void this.usage.recordApiHit({
            walletAddress: this.extractWallet(req),
            method: req.method ?? 'GET',
            endpoint: req.originalUrl ?? req.url ?? '',
            statusCode: res.statusCode ?? 500,
            durationMs: Date.now() - started,
          });
        },
      }),
    );
  }

  private extractWallet(req: {
    headers?: Record<string, string | string[] | undefined>;
    query?: Record<string, unknown>;
    walletAddress?: string;
  }): string | undefined {
    if (req.walletAddress) return req.walletAddress;
    const h = req.headers?.['x-wallet-address'];
    if (typeof h === 'string' && h.trim()) return h.trim();
    if (Array.isArray(h) && h[0]) return String(h[0]).trim();
    const q = req.query?.wallet;
    if (typeof q === 'string' && q.trim()) return q.trim();
    return undefined;
  }
}
