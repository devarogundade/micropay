import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ImageJobEntity } from '../../database/entities/image-job.entity';
import { ImageGenerationEntity } from '../../database/entities/image-generation.entity';
import {
  PaymentsService,
  X402SettleError,
} from '../payments/payments.service';
import { PricingService } from '../pricing/pricing.service';
import { AiService } from '../ai/ai.service';
import { StorageService } from '../storage/storage.service';
import { QueueService } from '../queue/queue.service';
import { UsersService } from '../users/users.service';
import { ActivitiesService } from '../activities/activities.service';
import { ActivityStatus } from '../../database/entities/activity.entity';
import { UsageService } from '../usage/usage.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(ImageJobEntity)
    private readonly imageJobs: Repository<ImageJobEntity>,
    @InjectRepository(ImageGenerationEntity)
    private readonly generations: Repository<ImageGenerationEntity>,
    private readonly payments: PaymentsService,
    private readonly pricing: PricingService,
    private readonly ai: AiService,
    private readonly storage: StorageService,
    private readonly queues: QueueService,
    private readonly users: UsersService,
    private readonly activities: ActivitiesService,
    private readonly usage: UsageService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async generate(input: {
    body: Record<string, unknown>;
    paymentHeader?: string;
    walletAddress?: string;
    requestId?: string;
    asyncOnly?: boolean;
  }) {
    this.ai.assertRouterConfigured();
    const model = String(input.body.model ?? '');
    const prompt = String(input.body.prompt ?? '');
    if (!model) {
      throw new BadRequestException({
        error: { message: 'model is required', type: 'invalid_request' },
      });
    }
    if (!prompt) {
      throw new BadRequestException({
        error: { message: 'prompt is required', type: 'invalid_request' },
      });
    }

    const body: Record<string, unknown> = {
      ...input.body,
      response_format: 'b64_json',
    };
    const size =
      typeof body.size === 'string' ? body.size : null;
    const { amount: priceUsdc } = await this.pricing.resolveAmount(model);

    const gate = await this.payments.gatePaidRequest({
      priceUsdc,
      routeKey: 'POST /api/v1/images/generations',
      path: '/api/v1/images/generations',
      product: 'app',
      routeKind: 'images',
      description: `Image generation ${model}`,
      paymentHeader: input.paymentHeader,
      body,
      walletAddress: input.walletAddress,
      requestId: input.requestId,
    });

    if (!gate.ok) {
      return {
        paymentRequired: true as const,
        status: gate.status,
        body: gate.body,
        headers: gate.headers,
      };
    }

    let txId = '—';
    let paymentHeaders: Record<string, string> = {};
    try {
      const settled = await gate.settle();
      paymentHeaders = settled.headers;
      txId = settled.txId;
    } catch (e) {
      if (e instanceof X402SettleError) {
        return {
          paymentRequired: true as const,
          status: 402,
          body: {
            error: { message: e.message, type: 'settlement_failed' },
          },
          headers: e.headers,
        };
      }
      throw e;
    }

    if (input.walletAddress) {
      await this.activities.record({
        walletAddress: input.walletAddress,
        modelSlug: model,
        modelName: model,
        type: 'Image Gen',
        costUsdc: gate.priceUsdc,
        status: ActivityStatus.settled,
        txId,
      });
      await this.usage.recordAiUsage({
        walletAddress: input.walletAddress,
        product: 'app',
        model,
        costUsdc: gate.priceUsdc,
        endpoint: '/api/v1/images/generations',
      });
    }

    if (input.asyncOnly) {
      // Enqueue only — worker runs provider inference (avoid double-submit).
      const jobId = randomUUID();
      await this.upsertImageJob({
        jobId,
        walletAddress: input.walletAddress,
        modelSlug: model,
        prompt,
        size,
        status: 'queued',
      });
      await this.queues.enqueueImage({
        jobId,
        imageJobId: jobId,
        walletAddress: input.walletAddress,
        model,
        prompt,
        size: size ?? undefined,
      });
      this.realtime.emitJobProgress({
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        walletAddress: input.walletAddress,
      });
      return {
        paymentRequired: false as const,
        status: 202,
        body: { jobId, status: 'queued', type: 'image' },
        paymentHeaders,
      };
    }

    const { data } = await this.ai.generateImageSynced(body);
    const persisted = await this.persistImages(data, {
      walletAddress: input.walletAddress,
      model,
      prompt,
      size,
    });

    return {
      paymentRequired: false as const,
      status: 200,
      body: persisted,
      paymentHeaders,
    };
  }

  async upsertImageJob(input: {
    jobId: string;
    walletAddress?: string;
    modelSlug: string;
    prompt: string;
    size?: string | null;
    providerAddress?: string | null;
    status?: string;
    errorMessage?: string | null;
  }) {
    let userId: string | null = null;
    if (input.walletAddress) {
      const user = await this.users.ensureUser(input.walletAddress);
      userId = user.id;
    }
    const existing = await this.imageJobs.findOne({
      where: { id: input.jobId },
    });
    if (existing) {
      existing.status = input.status ?? existing.status;
      existing.errorMessage = input.errorMessage ?? existing.errorMessage;
      if (input.providerAddress !== undefined) {
        existing.providerAddress = input.providerAddress;
      }
      return this.imageJobs.save(existing);
    }
    return this.imageJobs.save(
      this.imageJobs.create({
        id: input.jobId,
        userId,
        walletAddress: input.walletAddress ?? null,
        modelSlug: input.modelSlug,
        modelName: input.modelSlug,
        prompt: input.prompt,
        size: input.size ?? null,
        providerAddress: input.providerAddress ?? null,
        status: input.status ?? 'queued',
      }),
    );
  }

  async getJob(jobId: string) {
    const row = await this.imageJobs.findOne({ where: { id: jobId } });
    if (!row) throw new NotFoundException('Image job not found');
    return {
      id: row.id,
      status: row.status,
      modelSlug: row.modelSlug,
      prompt: row.prompt,
      size: row.size,
      providerAddress: row.providerAddress,
      errorMessage: row.errorMessage,
      result: row.result,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async history(wallet?: string) {
    if (!wallet) return { data: [] };
    const user = await this.users.ensureUser(wallet);
    const rows = await this.generations.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        modelSlug: r.modelSlug,
        modelName: r.modelName,
        prompt: r.prompt,
        size: r.size,
        url: r.url,
        storagePath: r.storagePath,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async persistImages(
    payload: unknown,
    meta: {
      walletAddress?: string;
      model: string;
      prompt: string;
      size?: string | null;
    },
  ): Promise<Record<string, unknown>> {
    const found = this.collectImageItems(payload);
    if (!found) {
      return (payload as Record<string, unknown>) ?? { data: [] };
    }

    const next: Array<Record<string, unknown>> = [];
    for (let i = 0; i < found.items.length; i++) {
      const item = found.items[i]!;
      if (item.url && !item.b64_json) {
        next.push(item);
        continue;
      }
      const b64 = typeof item.b64_json === 'string' ? item.b64_json : null;
      if (!b64) {
        next.push(item);
        continue;
      }
      try {
        const buffer = Buffer.from(b64, 'base64');
        const asset = await this.storage.uploadBuffer({
          buffer,
          mimeType: 'image/png',
          originalName: `gen-${Date.now()}-${i}.png`,
          folder: 'images',
          walletAddress: meta.walletAddress,
        });
        next.push({
          ...item,
          url: asset.url,
          storagePath: asset.key,
          b64_json: undefined,
        });
        if (meta.walletAddress) {
          const user = await this.users.ensureUser(meta.walletAddress);
          await this.generations.save(
            this.generations.create({
              userId: user.id,
              modelSlug: meta.model,
              modelName: meta.model,
              prompt: meta.prompt,
              size: meta.size ?? null,
              url: asset.url ?? '',
              storagePath: asset.key ?? null,
            }),
          );
        }
      } catch {
        // Keep b64 if storage not configured so client still gets the image
        next.push(item);
      }
    }
    return found.wrap(next) as Record<string, unknown>;
  }

  private collectImageItems(payload: unknown): {
    items: Array<Record<string, unknown>>;
    wrap: (items: Array<Record<string, unknown>>) => unknown;
  } | null {
    if (!payload || typeof payload !== 'object') return null;
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      return {
        items: obj.data as Array<Record<string, unknown>>,
        wrap: (items) => ({ ...obj, data: items }),
      };
    }
    const result = obj.result;
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>;
      if (Array.isArray(r.data)) {
        return {
          items: r.data as Array<Record<string, unknown>>,
          wrap: (items) => ({ ...obj, result: { ...r, data: items } }),
        };
      }
    }
    return null;
  }
}
