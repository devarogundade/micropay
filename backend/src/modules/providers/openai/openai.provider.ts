import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  type RouterModelMeta,
} from '../provider.types';

export type OpenAiProviderConfig = {
  apiKey: string;
  /** Base URL including `/v1` suffix, e.g. `https://api.openai.com/v1`. */
  baseUrl: string;
};

/**
 * OpenAI-compatible HTTP provider (also used for 0G router OpenAI endpoints).
 */
@Injectable()
export class OpenAiProvider extends BaseAiProvider {
  readonly id = ProviderId.openai;
  private readonly logger = new Logger(OpenAiProvider.name);
  private config: OpenAiProviderConfig | null = null;

  configure(config: OpenAiProviderConfig) {
    this.config = config;
  }

  private requireConfig(): OpenAiProviderConfig {
    if (!this.config?.apiKey) {
      throw new ServiceUnavailableException({
        code: 'config_error',
        message:
          'OpenAI-compatible provider is not configured (missing API key).',
      });
    }
    return this.config;
  }

  async chatCompletions(
    req: ChatCompletionRequest,
  ): Promise<ChatCompletionResult> {
    const { apiKey, baseUrl } = this.requireConfig();
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...req, stream: false }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    return { status: res.status, data };
  }

  async chatCompletionsStream(
    req: ChatCompletionRequest,
  ): Promise<globalThis.Response> {
    const { apiKey, baseUrl } = this.requireConfig();
    return fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ ...req, stream: true }),
    });
  }

  async imageGenerations(
    req: ImageGenerationRequest,
  ): Promise<ImageGenerationResult> {
    const { apiKey, baseUrl } = this.requireConfig();
    const origin = baseUrl.replace(/\/v1\/?$/, '');
    const res = await fetch(`${origin}/v1/async/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...req, response_format: 'b64_json' }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok && res.status !== 202) {
      throw new ServiceUnavailableException({
        code: 'router_error',
        message:
          (data.error as { message?: string })?.message ||
          `Image generation failed (${res.status})`,
        details: data,
      });
    }
    return { status: res.status, data };
  }

  async pollImageJob(req: ImagePollRequest): Promise<ImagePollResult> {
    const { apiKey, baseUrl } = this.requireConfig();
    const origin = baseUrl.replace(/\/v1\/?$/, '');
    const qs = new URLSearchParams();
    if (req.model) qs.set('model', req.model);
    if (req.providerAddress) qs.set('provider_address', req.providerAddress);
    const q = qs.toString();
    const url = `${origin}/v1/async/jobs/${encodeURIComponent(req.jobId)}${q ? `?${q}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      throw new ServiceUnavailableException({
        code: 'router_error',
        message:
          (data.error as { message?: string })?.message ||
          `Job poll failed (${res.status})`,
      });
    }
    const retryAfterHeader = res.headers.get('Retry-After');
    return {
      status: res.status,
      data,
      retryAfter: retryAfterHeader
        ? Number(retryAfterHeader)
        : typeof data.retryAfter === 'number'
          ? data.retryAfter
          : undefined,
    };
  }

  async generateImageSynced(
    req: ImageGenerationRequest,
    opts?: { maxWaitMs?: number },
  ): Promise<{ status: number; data: unknown }> {
    const maxWait = opts?.maxWaitMs ?? 120_000;
    const submitted = await this.imageGenerations(req);
    const jobId = String(submitted.data.jobId || submitted.data.job_id || '');
    if (!jobId) {
      return { status: submitted.status, data: submitted.data };
    }
    const model = typeof req.model === 'string' ? req.model : undefined;
    const providerAddress =
      typeof submitted.data.provider_address === 'string'
        ? submitted.data.provider_address
        : undefined;
    const started = Date.now();
    while (Date.now() - started < maxWait) {
      const polled = await this.pollImageJob({
        jobId,
        model,
        providerAddress,
      });
      const st = String(polled.data.status || '').toLowerCase();
      if (st === 'completed' || st === 'succeeded' || st === 'success') {
        return {
          status: 200,
          data: polled.data.data ?? polled.data.result ?? polled.data,
        };
      }
      if (st === 'failed' || st === 'error') {
        throw new ServiceUnavailableException({
          code: 'router_error',
          message:
            (polled.data.error as { message?: string })?.message ||
            String(polled.data.errorMessage || 'Image generation failed'),
        });
      }
      const waitSec =
        polled.retryAfter && polled.retryAfter > 0 ? polled.retryAfter : 3;
      await new Promise((r) => setTimeout(r, waitSec * 1000));
    }
    throw new ServiceUnavailableException({
      code: 'router_error',
      message: 'Image generation timed out',
    });
  }

  async audioTranscriptions(
    req: AudioTranscriptionRequest,
  ): Promise<AudioTranscriptionResult> {
    const { apiKey, baseUrl } = this.requireConfig();
    const form = new FormData();
    const bytes = new Uint8Array(req.buffer);
    const blob = new Blob([bytes], {
      type: req.mimeType || 'application/octet-stream',
    });
    form.append('file', blob, req.filename || 'audio.webm');
    form.append('model', req.model);
    if (req.language) form.append('language', req.language);

    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const contentType = res.headers.get('content-type') || 'application/json';
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ServiceUnavailableException({
          code: 'router_error',
          message:
            (data as { error?: { message?: string } })?.error?.message ||
            `Transcription failed (${res.status})`,
        });
      }
      return { status: res.status, data };
    }
    const text = await res.text();
    if (!res.ok) {
      throw new ServiceUnavailableException({
        code: 'router_error',
        message: text.slice(0, 200),
      });
    }
    return { status: res.status, data: { text } };
  }

  async listModels(): Promise<{ object?: string; data?: RouterModelMeta[] }> {
    const { apiKey, baseUrl } = this.requireConfig();
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      this.logger.warn(`listModels failed: ${res.status}`);
      throw new ServiceUnavailableException({
        code: 'router_error',
        message: `Models list failed: ${res.status}`,
      });
    }
    return (await res.json()) as {
      object?: string;
      data?: RouterModelMeta[];
    };
  }
}
