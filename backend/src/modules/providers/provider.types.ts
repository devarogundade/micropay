import { ProviderId } from '../../common/types/enums';
import type { ChatCompletionResponse } from '../../common/types/chat';

export { ProviderId };

export type ChatCompletionRequest = Record<string, unknown>;

export type ChatCompletionResult = {
  status: number;
  data: ChatCompletionResponse;
};

export type ImageGenerationRequest = Record<string, unknown>;

export type ImageGenerationResult = {
  status: number;
  data: Record<string, unknown>;
};

export type ImagePollRequest = {
  jobId: string;
  model?: string;
  providerAddress?: string;
};

export type ImagePollResult = {
  status: number;
  data: Record<string, unknown>;
  retryAfter?: number;
};

export type AudioTranscriptionRequest = {
  buffer: Buffer;
  filename?: string;
  mimeType?: string;
  model: string;
  language?: string;
};

export type AudioTranscriptionResult = {
  status: number;
  data: unknown;
};

export type RouterModelMeta = {
  id: string;
  supported_formats?: string[];
  [key: string]: unknown;
};

/**
 * Unified AI provider interface. Callers never talk to vendor APIs directly.
 */
export interface AiProvider {
  readonly id: ProviderId;

  chatCompletions(
    req: ChatCompletionRequest,
  ): Promise<ChatCompletionResult>;

  chatCompletionsStream?(
    req: ChatCompletionRequest,
  ): Promise<globalThis.Response>;

  imageGenerations?(
    req: ImageGenerationRequest,
  ): Promise<ImageGenerationResult>;

  pollImageJob?(req: ImagePollRequest): Promise<ImagePollResult>;

  generateImageSynced?(
    req: ImageGenerationRequest,
    opts?: { maxWaitMs?: number },
  ): Promise<{ status: number; data: unknown }>;

  audioTranscriptions?(
    req: AudioTranscriptionRequest,
  ): Promise<AudioTranscriptionResult>;

  listModels?(): Promise<{ object?: string; data?: RouterModelMeta[] }>;
}

export type ProviderResolveHints = {
  modelId?: string;
  supportedFormats?: string[] | null;
  /** Force a specific provider id when set. */
  prefer?: ProviderId;
};
