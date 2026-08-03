import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from '@x402/extensions/bazaar';
import {
  ALGORAND_USDC,
  GOPLAUSIBLE_FEE_PAYER,
  X402_CHALLENGE_TAG,
  type NetworkMode,
} from '../../config/networks';
import { PaymentProduct, RouteKind } from '../../common/types/enums';
import {
  CreditUsageEntity,
  WalletDailyCreditEntity,
} from '../../database/entities';

const DAILY_CREDIT_MICROS = 100_000;

export type CreditBreakdown = {
  allowanceUsdc: number;
  usedUsdc: number;
  remainingUsdc: number;
  listPriceUsdc: number;
  creditAppliedUsdc: number;
  chargeUsdc: number;
  resetsAt: string;
};

export type X402GateOk = {
  ok: true;
  payTo: string;
  priceUsdc: number;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
  declaredExtensions?: Record<string, unknown>;
  credit: CreditBreakdown;
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
  private resourceServerPromise?: Promise<x402ResourceServer>;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(WalletDailyCreditEntity)
    private readonly dailyCredits: Repository<WalletDailyCreditEntity>,
  ) {}

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private nextReset(): string {
    const reset = new Date();
    reset.setUTCDate(reset.getUTCDate() + 1);
    reset.setUTCHours(0, 0, 0, 0);
    return reset.toISOString();
  }

  private microsToUsdc(micros: number): number {
    if (!Number.isSafeInteger(micros) || micros < 0) {
      throw new Error('Credit ledger contains an invalid micro-USDC amount');
    }
    return Number((micros / 1_000_000).toFixed(6));
  }

  private usdcToMicros(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Payment price must be a finite positive USDC amount');
    }
    const micros = Math.round(amount * 1_000_000);
    if (!Number.isSafeInteger(micros) || micros <= 0) {
      throw new Error('Payment price is outside the supported USDC range');
    }
    return micros;
  }

  private ledgerMicros(value: unknown, field: string): number {
    const micros = Number(value);
    if (!Number.isSafeInteger(micros) || micros < 0) {
      throw new Error(`Credit ledger field ${field} is invalid`);
    }
    return micros;
  }

  async getDailyCredit(walletAddress?: string): Promise<CreditBreakdown> {
    const allowance = DAILY_CREDIT_MICROS;
    const row = walletAddress
      ? await this.dailyCredits.findOne({
          where: { walletAddress, day: this.today() },
        })
      : null;
    const used = row ? this.ledgerMicros(row.usedMicros, 'usedMicros') : 0;
    const reserved = row
      ? this.ledgerMicros(row.reservedMicros, 'reservedMicros')
      : 0;
    return {
      allowanceUsdc: this.microsToUsdc(allowance),
      usedUsdc: this.microsToUsdc(used),
      remainingUsdc: this.microsToUsdc(
        Math.max(0, allowance - used - reserved),
      ),
      listPriceUsdc: 0,
      creditAppliedUsdc: 0,
      chargeUsdc: 0,
      resetsAt: this.nextReset(),
    };
  }

  private async allocateCredit(input: {
    requestId?: string;
    walletAddress?: string;
    priceUsdc: number;
    product: PaymentProduct | string;
    routeKind: RouteKind | string;
  }): Promise<CreditBreakdown> {
    const listMicros = this.usdcToMicros(input.priceUsdc);
    if (!input.walletAddress || !input.requestId) {
      const daily = await this.getDailyCredit(input.walletAddress);
      return {
        ...daily,
        listPriceUsdc: this.microsToUsdc(listMicros),
        chargeUsdc: this.microsToUsdc(listMicros),
      };
    }

    return this.dataSource.transaction(async (manager) => {
      const usageRepo = manager.getRepository(CreditUsageEntity);
      const existing = await usageRepo.findOne({
        where: { requestId: input.requestId },
      });
      if (existing) {
        if (
          existing.walletAddress !== input.walletAddress ||
          this.ledgerMicros(existing.listPriceMicros, 'listPriceMicros') !==
            listMicros
        ) {
          throw new Error('Credit request ID was reused for a different request');
        }
        const daily = await manager.getRepository(WalletDailyCreditEntity).findOneByOrFail({
          walletAddress: existing.walletAddress,
          day: existing.day,
        });
        const allowance = this.ledgerMicros(
          daily.allowanceMicros,
          'allowanceMicros',
        );
        const used = this.ledgerMicros(daily.usedMicros, 'usedMicros');
        const reserved = this.ledgerMicros(
          daily.reservedMicros,
          'reservedMicros',
        );
        const credit = this.ledgerMicros(existing.creditMicros, 'creditMicros');
        const charged = this.ledgerMicros(
          existing.chargedMicros,
          'chargedMicros',
        );
        return {
          allowanceUsdc: this.microsToUsdc(allowance),
          usedUsdc: this.microsToUsdc(used),
          remainingUsdc: this.microsToUsdc(
            Math.max(0, allowance - used - reserved),
          ),
          listPriceUsdc: this.microsToUsdc(listMicros),
          creditAppliedUsdc: this.microsToUsdc(credit),
          chargeUsdc: this.microsToUsdc(charged),
          resetsAt: this.nextReset(),
        };
      }

      const day = this.today();
      await manager.query(
        `INSERT INTO "WalletDailyCredit" ("walletAddress", "day", "allowanceMicros", "usedMicros", "reservedMicros") VALUES ($1, $2, $3, 0, 0) ON CONFLICT ("walletAddress", "day") DO NOTHING`,
        [input.walletAddress, day, DAILY_CREDIT_MICROS],
      );
      const rows = (await manager.query(
        `SELECT * FROM "WalletDailyCredit" WHERE "walletAddress" = $1 AND "day" = $2 FOR UPDATE`,
        [input.walletAddress, day],
      )) as WalletDailyCreditEntity[];
      const daily = rows[0];
      if (!daily) throw new Error('Unable to allocate daily credit');
      const allowance = this.ledgerMicros(
        daily.allowanceMicros,
        'allowanceMicros',
      );
      const usedBefore = this.ledgerMicros(daily.usedMicros, 'usedMicros');
      let reservedBefore = this.ledgerMicros(
        daily.reservedMicros,
        'reservedMicros',
      );
      const staleResult = (await manager.query(
        `UPDATE "CreditUsage" SET "status" = 'expired' WHERE "walletAddress" = $1 AND "day" = $2 AND "status" = 'reserved' AND "expiresAt" < now() RETURNING "creditMicros"`,
        [input.walletAddress, day],
      )) as unknown;
      // TypeORM's Postgres driver can return UPDATE results as [rows, count].
      const stale = (
        Array.isArray(staleResult) && Array.isArray(staleResult[0])
          ? staleResult[0]
          : staleResult
      ) as Array<{ creditMicros: string }>;
      const released = stale.reduce(
        (sum, row) =>
          sum + this.ledgerMicros(row.creditMicros, 'creditMicros'),
        0,
      );
      reservedBefore = Math.max(0, reservedBefore - released);
      const credit = Math.min(
        listMicros,
        Math.max(0, allowance - usedBefore - reservedBefore),
      );
      const charged = listMicros - credit;
      const reserved = reservedBefore + credit;

      await manager.update(
        WalletDailyCreditEntity,
        { walletAddress: input.walletAddress, day },
        { reservedMicros: String(reserved) },
      );
      await usageRepo.insert({
        requestId: input.requestId,
        walletAddress: input.walletAddress,
        day,
        product: String(input.product),
        routeKind: String(input.routeKind),
        listPriceMicros: String(listMicros),
        creditMicros: String(credit),
        chargedMicros: String(charged),
        status: 'reserved',
        expiresAt: new Date(Date.now() + 5 * 60_000),
      });

      return {
        allowanceUsdc: this.microsToUsdc(allowance),
        usedUsdc: this.microsToUsdc(usedBefore),
        remainingUsdc: this.microsToUsdc(
          Math.max(0, allowance - usedBefore - reserved),
        ),
        listPriceUsdc: this.microsToUsdc(listMicros),
        creditAppliedUsdc: this.microsToUsdc(credit),
        chargeUsdc: this.microsToUsdc(charged),
        resetsAt: this.nextReset(),
      };
    });
  }

  private async consumeCredit(requestId?: string): Promise<void> {
    if (!requestId) return;
    await this.dataSource.transaction(async (manager) => {
      const usage = await manager.getRepository(CreditUsageEntity).findOne({
        where: { requestId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!usage || usage.status !== 'reserved') return;
      const daily = await manager.getRepository(WalletDailyCreditEntity).findOne({
        where: { walletAddress: usage.walletAddress, day: usage.day },
        lock: { mode: 'pessimistic_write' },
      });
      if (!daily) return;
      const credit = this.ledgerMicros(usage.creditMicros, 'creditMicros');
      const reserved = this.ledgerMicros(
        daily.reservedMicros,
        'reservedMicros',
      );
      const used = this.ledgerMicros(daily.usedMicros, 'usedMicros');
      daily.reservedMicros = String(
        Math.max(0, reserved - credit),
      );
      daily.usedMicros = String(used + credit);
      usage.status = 'consumed';
      await manager.save(WalletDailyCreditEntity, daily);
      await manager.save(CreditUsageEntity, usage);
    });
  }

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

  private getResourceUrl(path: string): string {
    const baseUrl = this.config.get<string>('x402.resourceBaseUrl');
    if (!baseUrl) {
      throw new Error('PUBLIC_API_URL is required for Bazaar discovery');
    }
    return `${baseUrl}${path}`;
  }

  private getDiscoveryMetadata(routeKind: RouteKind | string) {
    switch (routeKind) {
      case RouteKind.chat:
        return {
          serviceName: 'Micropay Chat',
          tags: ['ai', 'chat', 'llm', 'x402', 'openai-compatible'],
          extension: declareDiscoveryExtension({
            bodyType: 'json',
            input: { model: 'model-id', messages: [{ role: 'user', content: 'Hello' }] },
            inputSchema: {
              type: 'object',
              properties: {
                model: { type: 'string' },
                messages: { type: 'array' },
                stream: { type: 'boolean' },
              },
              required: ['model', 'messages'],
            },
            output: { example: { choices: [{ message: { role: 'assistant', content: 'Hello!' } }] } },
          }),
        };
      case RouteKind.images:
        return {
          serviceName: 'Micropay Images',
          tags: ['ai', 'images', 'generation', 'x402', 'openai-compatible'],
          extension: declareDiscoveryExtension({
            bodyType: 'json',
            input: { model: 'model-id', prompt: 'A sunrise over mountains' },
            inputSchema: {
              type: 'object',
              properties: {
                model: { type: 'string' },
                prompt: { type: 'string' },
                size: { type: 'string' },
              },
              required: ['model', 'prompt'],
            },
            output: { example: { data: [{ b64_json: 'base64-encoded-png' }] } },
          }),
        };
      case RouteKind.audio:
        return {
          serviceName: 'Micropay Audio',
          tags: ['ai', 'audio', 'transcription', 'x402', 'speech-to-text'],
          extension: declareDiscoveryExtension({
            bodyType: 'form-data',
            input: { file: 'audio file', model: 'model-id' },
            inputSchema: {
              type: 'object',
              properties: {
                file: { type: 'string', format: 'binary' },
                model: { type: 'string' },
                language: { type: 'string' },
              },
              required: ['file', 'model'],
            },
            output: { example: { text: 'Transcribed speech' } },
          }),
        };
      case RouteKind.clone:
        return {
          serviceName: 'Micropay Templates',
          tags: ['ide', 'templates', 'puya-ts', 'x402', 'algorand'],
          extension: declareDiscoveryExtension({
            bodyType: 'json',
            input: { slug: 'starter-contract' },
            inputSchema: {
              type: 'object',
              properties: {
                templateId: { type: 'string' },
                id: { type: 'string' },
                slug: { type: 'string' },
              },
            },
            output: { example: { template: { slug: 'starter-contract', files: [] } } },
          }),
        };
      default:
        return {
          serviceName: 'Micropay IDE',
          tags: ['ai', 'ide', 'puya-ts', 'x402', 'algorand'],
          extension: declareDiscoveryExtension({
            bodyType: 'json',
            input: { model: 'model-id', messages: [{ role: 'user', content: 'Review this contract' }] },
            inputSchema: {
              type: 'object',
              properties: {
                model: { type: 'string' },
                messages: { type: 'array' },
                files: { type: 'array' },
              },
              required: ['model', 'messages'],
            },
            output: { example: { choices: [{ message: { role: 'assistant', content: 'Contract review' } }] } },
          }),
        };
    }
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

  private async getResourceServer(): Promise<x402ResourceServer> {
    if (!this.resourceServerPromise) {
      this.resourceServerPromise = (async () => {
        const facilitator = new HTTPFacilitatorClient({
          url: this.getFacilitatorUrl(),
        });
        const resourceServer = new x402ResourceServer(facilitator);
        resourceServer.register('algorand:*' as Network, new ExactAvmScheme());
        resourceServer.registerExtension(bazaarResourceServerExtension);
        return resourceServer;
      })();
    }
    return this.resourceServerPromise;
  }

  private async getHttpServer(routes: RoutesConfig): Promise<x402HTTPResourceServer> {
    const resourceServer = await this.getResourceServer();
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
    walletAddress?: string;
    requestId?: string;
  }): Promise<X402GateResult> {
    const credit = await this.allocateCredit({
      requestId: input.requestId,
      walletAddress: input.walletAddress,
      priceUsdc: input.priceUsdc,
      product: input.product,
      routeKind: input.routeKind,
    });
    const amountToCharge = credit.chargeUsdc;

    if (amountToCharge === 0) {
      return {
        ok: true,
        payTo: this.config.get<string>('x402.payTo') ?? '',
        priceUsdc: 0,
        paymentPayload: {} as PaymentPayload,
        paymentRequirements: {} as PaymentRequirements,
        credit,
        settle: async () => {
          await this.consumeCredit(input.requestId);
          return {
            headers: {
              'X-Credit-Applied': String(credit.creditAppliedUsdc),
              'X-Credit-Remaining': String(credit.remainingUsdc),
            },
            txId: 'credit',
          };
        },
      };
    }

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
      price = this.toX402Price(amountToCharge);
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
    const discovery = this.getDiscoveryMetadata(input.routeKind);

    const routes = {
      [input.routeKey]: {
        accepts: {
          scheme: 'exact',
          network,
          payTo,
          price,
          extra,
        },
        resource: this.getResourceUrl(input.path),
        description: input.description,
        mimeType: 'application/json',
        serviceName: discovery.serviceName,
        tags: discovery.tags,
        iconUrl: `${this.config.get<string>('cors.siteUrl') || 'https://micropay.website'}/assets/brand/icon.svg`,
        extensions: discovery.extension,
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
                    Math.round(amountToCharge * 1e6),
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
      priceUsdc: amountToCharge,
      credit,
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
          await this.consumeCredit(input.requestId);
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
