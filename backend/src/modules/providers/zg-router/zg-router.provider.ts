import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isOpenaiFormatMismatchError,
  requiresAnthropicFormat,
} from '../../ai/zg-anthropic';
import { AnthropicProvider } from '../anthropic/anthropic.provider';
import { OpenAiProvider } from '../openai/openai.provider';
import { BaseAiProvider } from '../base.provider';
import {
  ProviderId,
  type AudioTranscriptionRequest,
  type AudioTranscriptionResult,
  type ChatCompletionRequest,
  type ChatCompletionResult,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type ImagePollRequest,
  type ImagePollResult,
  type ProviderResolveHints,
  type RouterModelMeta,
} from '../provider.types';

/**
 * 0G Compute router — OpenAI-compatible endpoints with Anthropic Messages fallback.
 * Implements the unified AiProvider surface used by chat/image/audio/IDE.
 */
@Injectable()
export class ZgRouterProvider extends BaseAiProvider implements OnModuleInit {
  readonly id = ProviderId.zg_router;
  private readonly logger = new Logger(ZgRouterProvider.name);
  private modelFormatCache = new Map<string, string[] | undefined>();

  constructor(
    private readonly config: ConfigService,
    private readonly openai: OpenAiProvider,
    private readonly anthropic: AnthropicProvider,
  ) {
    super();
  }

  onModuleInit() {
    this.applyConfig();
  }

  private applyConfig() {
    const apiKey = this.config.get<string>('zgRouter.apiKey') ?? '';
    const baseUrl =
      this.config.get<string>('zgRouter.baseUrl') ??
      'https://router.0g.ai/v1';
    this.openai.configure({ apiKey, baseUrl });
    this.anthropic.configure({ apiKey, baseUrl });
  }

  assertConfigured() {
    this.applyConfig();
    const apiKey = this.config.get<string>('zgRouter.apiKey');
    const baseUrl = this.config.get<string>('zgRouter.baseUrl');
    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: 'config_error',
        message:
          'Server missing ZG_ROUTER_API_KEY. Set a provider inference key (server-side only).',
      });
    }
    return { apiKey: apiKey!, baseUrl: baseUrl! };
  }

  getRouterConfig() {
    const apiKey = this.config.get<string>('zgRouter.apiKey');
    const baseUrl = this.config.get<string>('zgRouter.baseUrl');
    const network = this.config.get<string>('zgRouter.network');
    return { apiKey, baseUrl, network, configured: Boolean(apiKey) };
  }

  async listModels(): Promise<{ object?: string; data?: RouterModelMeta[] }> {
    this.assertConfigured();
    return this.openai.listModels();
  }

  private async modelRequiresAnthropic(modelId: string): Promise<boolean> {
    if (!modelId) return false;
    let formats = this.modelFormatCache.get(modelId);
    if (formats === undefined && !this.modelFormatCache.has(modelId)) {
      try {
        const catalog = await this.listModels();
        for (const m of catalog.data ?? []) {
          this.modelFormatCache.set(m.id, m.supported_formats);
        }
        formats = this.modelFormatCache.get(modelId);
      } catch {
        this.modelFormatCache.set(modelId, undefined);
        return false;
      }
    }
    return requiresAnthropicFormat(formats);
  }

  async chatCompletions(
    req: ChatCompletionRequest,
  ): Promise<ChatCompletionResult> {
    this.assertConfigured();
    const modelId = String(req.model ?? '');
    if (await this.modelRequiresAnthropic(modelId)) {
      return this.anthropic.chatCompletions(req);
    }

    const result = await this.openai.chatCompletions(req);
    if (result.status < 400) return result;

    const err = result.data.error;
    const message =
      err && typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : `Chat completions failed (${result.status})`;

    if (isOpenaiFormatMismatchError(message)) {
      this.logger.debug(`Retrying ${modelId} via Anthropic /messages`);
      return this.anthropic.chatCompletions(req);
    }

    throw new ServiceUnavailableException({
      code: 'router_error',
      message,
      details: result.data,
    });
  }

  async chatCompletionsStream(
    req: ChatCompletionRequest,
  ): Promise<globalThis.Response> {
    this.assertConfigured();
    const modelId = String(req.model ?? '');
    if (await this.modelRequiresAnthropic(modelId)) {
      return this.anthropic.chatCompletionsStream!(req);
    }
    return this.openai.chatCompletionsStream(req);
  }

  async imageGenerations(
    req: ImageGenerationRequest,
  ): Promise<ImageGenerationResult> {
    this.assertConfigured();
    return this.openai.imageGenerations(req);
  }

  async pollImageJob(req: ImagePollRequest): Promise<ImagePollResult> {
    this.assertConfigured();
    return this.openai.pollImageJob(req);
  }

  async generateImageSynced(
    req: ImageGenerationRequest,
    opts?: { maxWaitMs?: number },
  ): Promise<{ status: number; data: unknown }> {
    this.assertConfigured();
    return this.openai.generateImageSynced(req, opts);
  }

  async audioTranscriptions(
    req: AudioTranscriptionRequest,
  ): Promise<AudioTranscriptionResult> {
    this.assertConfigured();
    return this.openai.audioTranscriptions(req);
  }

  /** Resolve which underlying transport fits a model (for diagnostics). */
  async resolveTransport(
    hints: ProviderResolveHints,
  ): Promise<ProviderId.openai | ProviderId.anthropic> {
    if (hints.prefer === ProviderId.anthropic) return ProviderId.anthropic;
    if (hints.prefer === ProviderId.openai) return ProviderId.openai;
    if (requiresAnthropicFormat(hints.supportedFormats)) {
      return ProviderId.anthropic;
    }
    if (hints.modelId && (await this.modelRequiresAnthropic(hints.modelId))) {
      return ProviderId.anthropic;
    }
    return ProviderId.openai;
  }
}
