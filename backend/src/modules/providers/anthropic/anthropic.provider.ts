import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  anthropicMessageToOpenaiCompletion,
  openaiChatBodyToAnthropicMessages,
} from '../../ai/zg-anthropic';
import { BaseAiProvider } from '../base.provider';
import {
  ProviderId,
  type ChatCompletionRequest,
  type ChatCompletionResult,
} from '../provider.types';

export type AnthropicProviderConfig = {
  apiKey: string;
  /** Base URL including `/v1`, e.g. ZG router or Anthropic. */
  baseUrl: string;
};

/**
 * Anthropic Messages API provider (OpenAI request shape in → OpenAI response out).
 */
@Injectable()
export class AnthropicProvider extends BaseAiProvider {
  readonly id = ProviderId.anthropic;
  private config: AnthropicProviderConfig | null = null;

  configure(config: AnthropicProviderConfig) {
    this.config = config;
  }

  private requireConfig(): AnthropicProviderConfig {
    if (!this.config?.apiKey) {
      throw new ServiceUnavailableException({
        code: 'config_error',
        message: 'Anthropic provider is not configured (missing API key).',
      });
    }
    return this.config;
  }

  async chatCompletions(
    req: ChatCompletionRequest,
  ): Promise<ChatCompletionResult> {
    const res = await this.postMessages(req, false);
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      throw new ServiceUnavailableException({
        code: 'router_error',
        message:
          (data.error as { message?: string })?.message ||
          `Anthropic messages failed (${res.status})`,
        details: data,
      });
    }
    return {
      status: 200,
      data: anthropicMessageToOpenaiCompletion(data),
    };
  }

  async chatCompletionsStream(
    req: ChatCompletionRequest,
  ): Promise<globalThis.Response> {
    return this.postMessages(req, true);
  }

  private async postMessages(
    body: ChatCompletionRequest,
    stream: boolean,
  ): Promise<globalThis.Response> {
    const { apiKey, baseUrl } = this.requireConfig();
    const anthropicBody = openaiChatBodyToAnthropicMessages({
      ...body,
      stream,
    });
    return fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(stream ? { Accept: 'text/event-stream' } : {}),
      },
      body: JSON.stringify(anthropicBody),
    });
  }
}
