import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AiJobEntity,
  AiJobStatus,
  AiJobType,
} from '../../database/entities/ai-job.entity';
import { KnowledgeDocEntity } from '../../database/entities/knowledge-doc.entity';
import { ToolDefEntity } from '../../database/entities/tool-def.entity';
import { QueueService } from '../queue/queue.service';
import { PricingService } from '../pricing/pricing.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { findWithPagination } from '../../common/helpers/typeorm-query.helper';
import { ProviderRegistry } from '../providers/provider.registry';
import { ZgRouterProvider } from '../providers/zg-router/zg-router.provider';
import type { RouterModelMeta } from '../providers/provider.types';

export type RouterModel = RouterModelMeta & {
  object?: string;
  name?: string;
  type?: string;
  owned_by?: string;
  description?: string;
  pricing_usd?: { prompt?: string; completion?: string; image?: string };
  price_usdc?: number;
  price_source?: 'rule' | 'default';
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly queues: QueueService,
    private readonly pricing: PricingService,
    private readonly providers: ProviderRegistry,
    private readonly zgRouter: ZgRouterProvider,
    @InjectRepository(AiJobEntity)
    private readonly jobs: Repository<AiJobEntity>,
    @InjectRepository(KnowledgeDocEntity)
    private readonly docs: Repository<KnowledgeDocEntity>,
    @InjectRepository(ToolDefEntity)
    private readonly tools: Repository<ToolDefEntity>,
  ) {}

  getRouterConfig() {
    return this.zgRouter.getRouterConfig();
  }

  assertRouterConfigured() {
    return this.zgRouter.assertConfigured();
  }

  /**
   * Proxy catalog to provider and enrich each model with resolved price_usdc.
   */
  async listModels(raw = false) {
    this.assertRouterConfigured();
    const provider = this.providers.defaultProvider();
    const data = await provider.listModels!();
    if (raw) return data;

    const list = Array.isArray(data.data) ? data.data : [];
    const enriched: RouterModel[] = [];
    for (const m of list) {
      const resolved = await this.pricing.resolveAmount(m.id, {
        type: typeof m.type === 'string' ? m.type : undefined,
      });
      enriched.push({
        ...m,
        price_usdc: resolved.amount,
        price_source: resolved.source,
      });
    }
    return { object: data.object ?? 'list', data: enriched };
  }

  /**
   * Chat completions via unified provider interface.
   */
  async proxyChatCompletion(
    body: Record<string, unknown>,
  ): Promise<{ status: number; data: Record<string, unknown> }> {
    const provider = this.providers.resolve({
      modelId: String(body.model ?? ''),
    });
    const result = await provider.chatCompletions(body);
    return {
      status: result.status,
      data: result.data as Record<string, unknown>,
    };
  }

  /** Stream chat completions — returns the raw upstream fetch Response (SSE). */
  async proxyChatCompletionStream(
    body: Record<string, unknown>,
  ): Promise<globalThis.Response> {
    const provider = this.providers.resolve({
      modelId: String(body.model ?? ''),
    });
    if (!provider.chatCompletionsStream) {
      throw new ServiceUnavailableException({
        code: 'provider_error',
        message: 'Provider does not support streaming',
      });
    }
    return provider.chatCompletionsStream(body);
  }

  async submitImageGeneration(body: Record<string, unknown>): Promise<{
    status: number;
    data: Record<string, unknown>;
  }> {
    const provider = this.providers.defaultProvider();
    if (!provider.imageGenerations) {
      throw new ServiceUnavailableException({
        code: 'provider_error',
        message: 'Provider does not support image generation',
      });
    }
    return provider.imageGenerations(body);
  }

  async pollImageJob(input: {
    jobId: string;
    model?: string;
    providerAddress?: string;
  }): Promise<{ status: number; data: Record<string, unknown>; retryAfter?: number }> {
    const provider = this.providers.defaultProvider();
    if (!provider.pollImageJob) {
      throw new ServiceUnavailableException({
        code: 'provider_error',
        message: 'Provider does not support image job polling',
      });
    }
    return provider.pollImageJob(input);
  }

  async generateImageSynced(
    body: Record<string, unknown>,
    opts?: { maxWaitMs?: number },
  ): Promise<{ status: number; data: unknown }> {
    const provider = this.providers.defaultProvider();
    if (!provider.generateImageSynced) {
      throw new ServiceUnavailableException({
        code: 'provider_error',
        message: 'Provider does not support synced image generation',
      });
    }
    return provider.generateImageSynced(body, opts);
  }

  async createAudioTranscription(input: {
    buffer: Buffer;
    filename?: string;
    mimeType?: string;
    model: string;
    language?: string;
  }): Promise<{ status: number; data: unknown }> {
    const provider = this.providers.defaultProvider();
    if (!provider.audioTranscriptions) {
      throw new ServiceUnavailableException({
        code: 'provider_error',
        message: 'Provider does not support audio transcription',
      });
    }
    return provider.audioTranscriptions(input);
  }

  /** Inject active knowledge docs into IDE agent messages. */
  async enrichIdeAgentBody(
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const docs = await this.docs.find({
      where: { active: true },
      order: { updatedAt: 'DESC' },
      take: 5,
    });
    const tools = await this.tools.find({
      where: { active: true, scope: 'ide' },
      take: 20,
    });

    if (!docs.length && !tools.length) return body;

    const knowledgeBlock = docs
      .map((d) => `### ${d.title}\n${d.content}`)
      .join('\n\n');
    const toolsBlock = tools
      .map((t) => `- ${t.name}: ${t.description ?? ''}`)
      .join('\n');

    const systemExtra = [
      knowledgeBlock
        ? `You have access to the following Micropay IDE knowledge:\n\n${knowledgeBlock}`
        : '',
      toolsBlock ? `Available IDE tools:\n${toolsBlock}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    if (!systemExtra) return body;

    const messages = Array.isArray(body.messages)
      ? [...(body.messages as Array<Record<string, unknown>>)]
      : [];
    const first = messages[0];
    if (first && first.role === 'system') {
      messages[0] = {
        ...first,
        content: `${String(first.content ?? '')}\n\n${systemExtra}`,
      };
    } else {
      messages.unshift({ role: 'system', content: systemExtra });
    }
    return { ...body, messages };
  }

  async createJob(input: {
    type: AiJobType;
    walletAddress?: string;
    product?: string;
    model?: string;
    payload?: Record<string, unknown>;
  }) {
    const job = await this.jobs.save(
      this.jobs.create({
        type: input.type,
        status: AiJobStatus.queued,
        walletAddress: input.walletAddress ?? null,
        product: input.product ?? null,
        model: input.model ?? null,
        progress: 0,
        input: input.payload ?? null,
      }),
    );

    const bull = await this.enqueueByType(job.id, input);

    job.bullJobId = String(bull.id);
    return this.jobs.save(job);
  }

  private enqueueByType(
    jobId: string,
    input: {
      type: AiJobType;
      walletAddress?: string;
      product?: string;
      model?: string;
      payload?: Record<string, unknown>;
    },
  ) {
    const payload = {
      jobId,
      type: input.type,
      walletAddress: input.walletAddress,
      product: input.product,
      model: input.model,
      input: input.payload,
    };
    switch (input.type) {
      case AiJobType.chat:
        return this.queues.enqueueChat(payload);
      case AiJobType.audio:
        return this.queues.enqueueAudio(payload);
      case AiJobType.ide_agent:
        return this.queues.enqueueIde(payload);
      case AiJobType.embed:
        return this.queues.enqueueEmbed({
          jobId,
          knowledgeDocId: String(input.payload?.knowledgeDocId ?? ''),
          walletAddress: input.walletAddress,
        });
      case AiJobType.image:
        return this.queues.enqueueImage({
          jobId,
          imageJobId: String(input.payload?.imageJobId ?? jobId),
          walletAddress: input.walletAddress,
          model: input.model,
          prompt: String(input.payload?.prompt ?? ''),
          size:
            typeof input.payload?.size === 'string'
              ? input.payload.size
              : undefined,
        });
      default:
        return this.queues.enqueueProcess(payload);
    }
  }

  async updateJob(
    id: string,
    patch: Partial<
      Pick<
        AiJobEntity,
        'status' | 'progress' | 'message' | 'result' | 'error'
      >
    >,
  ) {
    await this.jobs.update({ id }, patch as never);
    return this.jobs.findOne({ where: { id } });
  }

  async getJob(id: string) {
    return this.jobs.findOne({ where: { id } });
  }

  listKnowledge(query: PaginationQueryDto) {
    return findWithPagination(this.docs, query, {
      where: { active: true },
      searchFields: ['title', 'slug', 'content'],
      allowedSort: ['updatedAt', 'createdAt', 'title'],
    });
  }

  listTools(query: PaginationQueryDto, scope?: string) {
    return findWithPagination(this.tools, query, {
      where: scope ? { scope, active: true } : { active: true },
      searchFields: ['name', 'description'],
      allowedSort: ['name', 'updatedAt'],
    });
  }

  async enqueueEmbed(knowledgeDocId: string, walletAddress?: string) {
    const job = await this.jobs.save(
      this.jobs.create({
        type: AiJobType.embed,
        status: AiJobStatus.queued,
        walletAddress: walletAddress ?? null,
        input: { knowledgeDocId },
      }),
    );
    const bull = await this.queues.enqueueEmbed({
      jobId: job.id,
      knowledgeDocId,
      walletAddress,
    });
    job.bullJobId = String(bull.id);
    return this.jobs.save(job);
  }
}
