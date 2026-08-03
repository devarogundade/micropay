import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranscriptionEntity } from '../../database/entities/transcription.entity';
import {
  PaymentsService,
  X402SettleError,
} from '../payments/payments.service';
import { PricingService } from '../pricing/pricing.service';
import { AiService } from '../ai/ai.service';
import { UsersService } from '../users/users.service';
import { ActivitiesService } from '../activities/activities.service';
import { ActivityStatus } from '../../database/entities/activity.entity';
import { UsageService } from '../usage/usage.service';
import { MAX_UPLOAD_BYTES } from '../storage/storage.service';
import {
  ActivityKind,
  AiJobStatus,
  AiJobType,
  PaymentProduct,
  RouteKind,
} from '../../common/types/enums';

@Injectable()
export class AudioService {
  constructor(
    @InjectRepository(TranscriptionEntity)
    private readonly transcriptions: Repository<TranscriptionEntity>,
    private readonly payments: PaymentsService,
    private readonly pricing: PricingService,
    private readonly ai: AiService,
    private readonly users: UsersService,
    private readonly activities: ActivitiesService,
    private readonly usage: UsageService,
  ) {}

  async transcribe(input: {
    file?: Express.Multer.File;
    model?: string;
    language?: string;
    paymentHeader?: string;
    walletAddress?: string;
    requestId?: string;
    asyncOnly?: boolean;
  }) {
    this.ai.assertRouterConfigured();
    const model = (input.model || '').trim();
    if (!model) {
      throw new BadRequestException({
        error: { message: 'model is required', type: 'invalid_request' },
      });
    }
    if (!input.file?.buffer?.length) {
      throw new BadRequestException({
        error: {
          message: 'file (audio) is required',
          type: 'invalid_request',
        },
      });
    }
    if (input.file.size > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException({
        error: {
          message: `Audio file exceeds ${MAX_UPLOAD_BYTES} byte limit`,
          type: 'invalid_request',
          maxBytes: MAX_UPLOAD_BYTES,
        },
      });
    }

    const { amount: priceUsdc } = await this.pricing.resolveAmount(model);
    const gate = await this.payments.gatePaidRequest({
      priceUsdc,
      routeKey: 'POST /api/v1/audio/transcriptions',
      path: '/api/v1/audio/transcriptions',
      product: PaymentProduct.app,
      routeKind: RouteKind.audio,
      description: `Speech-to-text transcription by ${model}, returning the spoken content as text.`,
      paymentHeader: input.paymentHeader,
      body: { model, language: input.language },
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
        type: ActivityKind.Audio,
        costUsdc: gate.priceUsdc,
        status: ActivityStatus.settled,
        txId,
      });
      await this.usage.recordAiUsage({
        walletAddress: input.walletAddress,
        product: PaymentProduct.app,
        model,
        costUsdc: gate.priceUsdc,
        endpoint: '/api/v1/audio/transcriptions',
      });
    }

    if (input.asyncOnly) {
      const job = await this.ai.createJob({
        type: AiJobType.audio,
        walletAddress: input.walletAddress,
        product: PaymentProduct.app,
        model,
        payload: {
          model,
          language: input.language,
          filename: input.file.originalname,
          mimeType: input.file.mimetype,
          fileSize: input.file.size,
          fileBase64: input.file.buffer.toString('base64'),
        },
      });
      return {
        paymentRequired: false as const,
        status: 202,
        body: {
          jobId: job.id,
          status: AiJobStatus.queued,
          type: AiJobType.audio,
        },
        paymentHeaders,
      };
    }

    const { status, data } = await this.ai.createAudioTranscription({
      buffer: input.file.buffer,
      filename: input.file.originalname,
      mimeType: input.file.mimetype,
      model,
      language: input.language,
    });

    const text =
      data && typeof data === 'object' && 'text' in data
        ? String((data as { text: unknown }).text ?? '')
        : typeof data === 'string'
          ? data
          : JSON.stringify(data);

    if (input.walletAddress) {
      const user = await this.users.ensureUser(input.walletAddress);
      await this.transcriptions.save(
        this.transcriptions.create({
          userId: user.id,
          modelSlug: model,
          modelName: model,
          filename: input.file.originalname ?? null,
          mimeType: input.file.mimetype ?? null,
          fileSize: input.file.size ?? null,
          language: input.language ?? null,
          text,
        }),
      );
    }

    return {
      paymentRequired: false as const,
      status,
      body: typeof data === 'object' && data !== null ? data : { text },
      paymentHeaders,
    };
  }

  async history(wallet?: string) {
    if (!wallet) return { data: [] };
    const user = await this.users.ensureUser(wallet);
    const rows = await this.transcriptions.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        modelSlug: r.modelSlug,
        modelName: r.modelName,
        filename: r.filename,
        mimeType: r.mimeType,
        fileSize: r.fileSize,
        language: r.language,
        text: r.text,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
