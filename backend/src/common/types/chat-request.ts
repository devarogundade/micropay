import type {
  ChatAttachment,
  ChatCompletionResponse,
  IncomingChatMessage,
  OpenAiToolDefinition,
} from './chat';
import type { ToolName } from './enums';

export type {
  ChatAttachment,
  ChatCompletionResponse,
  IncomingChatMessage,
  OpenAiToolDefinition,
};

/** Body for POST /api/v1/chat/completions (OpenAI-compatible + Micropay extensions). */
export type ChatCompletionsBody = {
  model?: string;
  messages?: unknown[];
  stream?: boolean;
  /**
   * OpenAI tools array. Special cases:
   * - `null` or `[]` → disable server tools
   * - omitted → server default enabled builtins
   * - non-empty → merge/filter with server builtins (function names act as allowlist when no tool_names)
   */
  tools?: OpenAiToolDefinition[] | null;
  /**
   * Simpler allowlist of registered builtin tool names.
   * Example: `["web_search","pdf_extract"]`
   */
  tool_names?: Array<ToolName | string>;
  tool_choice?: unknown;
  /**
   * When true (or header `x-async: 1`), return `{ jobId, status }` and run via BullMQ + WS.
   */
  async?: boolean;
  [key: string]: unknown;
};

export type ChatAsyncJobResponse = {
  jobId: string;
  status: string;
  type: string;
};
