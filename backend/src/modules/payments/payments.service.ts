import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExactAvmScheme } from '@x402/avm/exact/server';
import {
  ALGORAND_MAINNET_GENESIS_HASH,
  ALGORAND_TESTNET_GENESIS_HASH,
} from '@x402/avm';
import {
  decodePaymentResponseHeader,
  encodePaymentResponseHeader,
} from '@x402/core/http';
import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
  type HTTPAdapter,
  type HTTPProcessResult,
  type HTTPRequestContext,
  type RoutesConfig,
} from '@x402/core/server';
import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
} from '@x402/core/types';
import { bazaarResourceServerExtension } from '@x402/extensions/bazaar';
import {
  ALGORAND_USDC,
  GOPLAUSIBLE_FEE_PAYER,
  X402_CHALLENGE_TAG,
  type NetworkMode,
} from '../../config/networks';
import { PaymentProduct, RouteKind } from '../../common/types/enums';

export type X402GateOk = {
  ok: true;
  payTo: string;
  priceUsdc: number;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
  declaredExtensions?: Record<string, unknown>;
  settle: () => Promise<{
    headers: Record<string, string>;
    txId: string;
  }>;
};

export type X402GateFail = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
};

export type X402GateResult = X402GateOk | X402GateFail;

export class X402SettleError extends Error {
  headers: Record<string, string>;
  constructor(message: string, headers: Record<string, string>) {
    super(message);
    this.name = 'X402SettleError';
    this.headers = headers;
  }
}

/**
 * x402 payment gate — GoPlausible facilitator verify → settle (exact USDC).
 * Ported from app/code `x402-server.ts` for Nest/Express.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly config: ConfigService) {}

  getNetwork(): NetworkMode {
    return (this.config.get<string>('x402.network') as NetworkMode) ?? 'testnet';
  }

  /** Single merchant address for both app and code products. */
  getPayTo(_product: PaymentProduct | 'app' | 'code' = PaymentProduct.app): string {
    const addr = this.config.get<string>('x402.payTo');
    if (!addr) {
      throw new ServiceUnavailableException({
        code: 'config_error',
        message: 'X402_PAY_TO is required (Algorand address to receive USDC)',
      });
    }
    return addr;
  }

  getFacilitatorUrl(): string {
    return (
      this.config.get<string>('x402.facilitatorUrl') ??
      'https://facilitator.goplausible.xyz'
    );
  }

  getFeePayer(): string {
    return this.config.get<string>('x402.feePayer') || GOPLAUSIBLE_FEE_PAYER;
  }

  getUsdcAsa(): string {
    return ALGORAND_USDC[this.getNetwork()].asaId;
  }

  getChallengeTag(): string {
    return X402_CHALLENGE_TAG;
  }

  /** Full genesis-hash CAIP-2 ids required by GoPlausible `/supported`. */
  getCaip2(): string {
    return this.getNetwork() === 'testnet'
      ? `algorand:${ALGORAND_TESTNET_GENESIS_HASH}`
      : `algorand:${ALGORAND_MAINNET_GENESIS_HASH}`;
  }

  x402Configured(_product?: PaymentProduct | 'app' | 'code'): boolean {
    try {
      this.getPayTo();
      return true;
    } catch {
      return false;
    }
  }

  toX402Price(usdc: number): string {
    if (!Number.isFinite(usdc) || usdc <= 0) {
      throw new Error(`Invalid x402 price (${String(usdc)})`);
    }
    const fixed =
      usdc < 0.0001
        ? usdc.toFixed(6)
        : usdc < 0.01
          ? usdc.toFixed(4)
          : usdc.toFixed(3);
    const trimmed = fixed.replace(/\.?0+$/, '');
    return `$${trimmed || fixed}`;
  }

  txIdFromPaymentHeaders(headers: Record<string, string>): string {
    const raw =
      headers['PAYMENT-RESPONSE'] ||
      headers['payment-response'] ||
      headers['Payment-Response'];
    if (!raw) return '—';
    try {
      const decoded = decodePaymentResponseHeader(raw) as {
        transaction?: string;
        txId?: string;
      };
      return decoded.transaction || decoded.txId || '—';
    } catch {
      return raw.slice(0, 16) + '…';
    }
  }

  encodeSettleHeader(settle: {
    success: boolean;
    transaction?: string;
    network?: string;
    errorReason?: string;
  }): string {
    return encodePaymentResponseHeader(settle as never);
  }

  private makeAdapter(input: {
    method: string;
    path: string;
    url?: string;
    headers: Record<string, string | undefined>;
    body: unknown;
  }): HTTPAdapter {
    const headerMap = new Map<string, string>();
    for (const [k, v] of Object.entries(input.headers)) {
      if (v) headerMap.set(k.toLowerCase(), v);
    }
    return {
      getHeader(name: string) {
        return headerMap.get(name.toLowerCase()) ?? undefined;
      },
      getMethod() {
        return input.method;
      },
      getPath() {
        return input.path;
      },
      getUrl() {
        return input.url ?? `http://localhost${input.path}`;
      },
      getAcceptHeader() {
        return headerMap.get('accept') ?? '*/*';
      },
      getUserAgent() {
        return headerMap.get('user-agent') ?? '';
      },
      getQueryParams() {
        return {};
      },
      getQueryParam() {
        return undefined;
      },
      getBody() {
        return input.body;
      },
    };
  }

  private async getHttpServer(
    routes: RoutesConfig,
  ): Promise<x402HTTPResourceServer> {
    const facilitator = new HTTPFacilitatorClient({
      url: this.getFacilitatorUrl(),
    });
    const resourceServer = new x402ResourceServer(facilitator);
    resourceServer.register('algorand:*' as Network, new ExactAvmScheme());
    resourceServer.registerExtension(bazaarResourceServerExtension);
    const httpServer = new x402HTTPResourceServer(resourceServer, routes);
    await httpServer.initialize();
    return httpServer;
  }

  /**
   * Enforce x402 on a protected API call.
   * Missing payment → 402 challenge. Present → facilitator verify; settle after success.
   */
  async gatePaidRequest(input: {
    priceUsdc: number;
    routeKey: string;
    path: string;
    product: PaymentProduct | 'app' | 'code';
    routeKind: RouteKind | string;
    description: string;
    paymentHeader?: string;
    method?: string;
    url?: string;
    headers?: Record<string, string | undefined>;
    body?: unknown;
  }): Promise<X402GateResult> {
    if (!this.x402Configured()) {
      return {
        ok: false,
        status: 503,
        body: {
          error: {
            message:
              'Server missing X402_PAY_TO. Set a Mainnet/Testnet Algorand address to receive USDC micropayments.',
            type: 'config_error',
          },
        },
      };
    }

    const payTo = this.getPayTo();
    const network = this.getCaip2() as Network;
    const asset = this.getUsdcAsa();
    let price: string;
    try {
      price = this.toX402Price(input.priceUsdc);
    } catch (e) {
      return {
        ok: false,
        status: 500,
        body: {
          error: {
            message: e instanceof Error ? e.message : 'Invalid payment price',
            type: 'config_error',
          },
        },
      };
    }

    const extra = {
      asset,
      feePayer: this.getFeePayer(),
      tag: this.getChallengeTag(),
      routeKind: input.routeKind,
      product: input.product,
    };

    const routes = {
      [input.routeKey]: {
        accepts: {
          scheme: 'exact',
          network,
          payTo,
          price,
          extra,
        },
        description: input.description,
        mimeType: 'application/json',
        unpaidResponseBody: () => ({
          contentType: 'application/json',
          body: {
            error: {
              message: 'Payment required',
              type: 'payment_required',
            },
            x402: {
              price,
              network,
              asset,
              payTo,
              facilitator: this.getFacilitatorUrl(),
              tag: extra.tag,
              feePayer: extra.feePayer,
            },
            // OpenAI-style envelope some clients still parse
            success: false,
            data: {
              x402Version: 1,
              accepts: [
                {
                  scheme: 'exact',
                  network,
                  maxAmountRequired: String(
                    Math.round(input.priceUsdc * 1e6),
                  ),
                  resource: input.path,
                  description: input.description,
                  mimeType: 'application/json',
                  payTo,
                  maxTimeoutSeconds: 60,
                  asset,
                  extra,
                },
              ],
            },
          },
        }),
      },
    } as RoutesConfig;

    let httpServer: x402HTTPResourceServer;
    try {
      httpServer = await this.getHttpServer(routes);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'x402 init failed';
      this.logger.error(message);
      return {
        ok: false,
        status: 502,
        body: { error: { message, type: 'x402_error' } },
      };
    }

    const headers = {
      ...(input.headers ?? {}),
      'payment-signature': input.paymentHeader,
      'x-payment': input.paymentHeader,
    };
    const adapter = this.makeAdapter({
      method: input.method ?? 'POST',
      path: input.path,
      url: input.url,
      headers,
      body: input.body ?? {},
    });

    const context: HTTPRequestContext = {
      adapter,
      path: input.path,
      method: input.method ?? 'POST',
      paymentHeader: input.paymentHeader,
    };

    let result: HTTPProcessResult;
    try {
      result = await httpServer.processHTTPRequest(context);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'x402 processing failed';
      return {
        ok: false,
        status: 502,
        body: { error: { message, type: 'x402_error' } },
      };
    }

    if (result.type === 'payment-error') {
      const { status, headers: resHeaders, body } = result.response;
      const parsed =
        typeof body === 'string'
          ? (() => {
              try {
                return JSON.parse(body) as Record<string, unknown>;
              } catch {
                return { error: { message: body, type: 'payment_required' } };
              }
            })()
          : ((body as Record<string, unknown>) ?? {
              error: { message: 'Payment Required', type: 'payment_required' },
            });
      return {
        ok: false,
        status: status || 402,
        body: parsed,
        headers: resHeaders,
      };
    }

    if (result.type === 'no-payment-required') {
      return {
        ok: false,
        status: 500,
        body: {
          error: {
            message: 'x402 route misconfigured (no payment required)',
            type: 'config_error',
          },
        },
      };
    }

    const { paymentPayload, paymentRequirements, declaredExtensions } = result;

    return {
      ok: true,
      payTo,
      priceUsdc: input.priceUsdc,
      paymentPayload,
      paymentRequirements,
      declaredExtensions,
      settle: async () => {
        const settleResult = await httpServer.processSettlement(
          paymentPayload,
          paymentRequirements,
          declaredExtensions,
          {
            request: context,
            responseBody: undefined,
            responseHeaders: undefined,
          },
        );

        if (settleResult.success) {
          const settleHeaders = settleResult.headers ?? {};
          return {
            headers: settleHeaders,
            txId: this.txIdFromPaymentHeaders(settleHeaders),
          };
        }

        throw new X402SettleError(
          settleResult.errorReason ||
            settleResult.errorMessage ||
            'Settlement failed',
          settleResult.headers ?? {},
        );
      },
    };
  }
}
