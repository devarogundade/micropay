import { ProviderId } from './provider.types';
import type {
  AiProvider,
  AudioTranscriptionRequest,
  AudioTranscriptionResult,
  ChatCompletionRequest,
  ChatCompletionResult,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImagePollRequest,
  ImagePollResult,
} from './provider.types';

/**
 * Abstract base for AI providers. Concrete classes implement the vendor API.
 */
export abstract class BaseAiProvider implements AiProvider {
  abstract readonly id: ProviderId;

  abstract chatCompletions(
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
}
