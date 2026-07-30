import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Reads wallet from `x-wallet-address` header or `?wallet=` query. */
export const WalletAddress = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      query?: Record<string, unknown>;
      walletAddress?: string;
    }>();
    if (req.walletAddress) return req.walletAddress;
    const h = req.headers?.['x-wallet-address'];
    if (typeof h === 'string' && h.trim()) return h.trim();
    if (Array.isArray(h) && h[0]) return String(h[0]).trim();
    const q = req.query?.wallet;
    if (typeof q === 'string' && q.trim()) return q.trim();
    return undefined;
  },
);
