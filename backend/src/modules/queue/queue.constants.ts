export const AI_PROCESS_QUEUE = 'ai.process';
export const AI_EMBED_QUEUE = 'ai.embed';
export const AI_IMAGE_QUEUE = 'ai.image';
export const AI_CHAT_QUEUE = 'ai.chat';
export const AI_AUDIO_QUEUE = 'ai.audio';
export const AI_IDE_QUEUE = 'ai.ide';

export type AiProcessJobPayload = {
  jobId: string;
  type: string;
  walletAddress?: string;
  product?: string;
  model?: string;
  input?: Record<string, unknown>;
};

export type AiEmbedJobPayload = {
  jobId: string;
  knowledgeDocId: string;
  walletAddress?: string;
};

export type AiImageJobPayload = {
  jobId: string;
  imageJobId: string;
  walletAddress?: string;
  model?: string;
  prompt: string;
  size?: string;
};

export type AiChatJobPayload = AiProcessJobPayload;
export type AiAudioJobPayload = AiProcessJobPayload;
export type AiIdeJobPayload = AiProcessJobPayload;
