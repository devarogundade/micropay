import type { ChatRole } from './enums';

export type ChatAttachment = {
  id?: string;
  type?: string;
  name?: string;
  url?: string;
  mimeType?: string;
  [key: string]: unknown;
};

export type IncomingChatMessage = {
  id?: string;
  role: ChatRole | string;
  content: string;
  attachments?: ChatAttachment[];
  reasoning?: string;
  modelId?: string;
  costUsdc?: number;
  provider?: string;
  error?: boolean;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type OpenAiFunctionCall = {
  name: string;
  arguments: string;
};

export type OpenAiToolCall = {
  id: string;
  type: 'function';
  function: OpenAiFunctionCall;
};

export type OpenAiChatMessage = {
  role: string;
  content?: string | null;
  name?: string;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
};

export type OpenAiToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
};

export type ChatCompletionChoice = {
  index?: number;
  message?: OpenAiChatMessage;
  finish_reason?: string | null;
  delta?: Partial<OpenAiChatMessage> & { content?: string | null };
};

export type ChatCompletionResponse = {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: ChatCompletionChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  [key: string]: unknown;
};
