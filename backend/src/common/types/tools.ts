import type { ToolExecution, ToolName, ToolScope } from './enums';
import type { OpenAiToolDefinition } from './chat';

export type ToolParameterSchema = Record<string, unknown>;

export type RegisteredTool = {
  name: ToolName | string;
  description: string;
  parameters: ToolParameterSchema;
  scope: ToolScope;
  execution: ToolExecution;
  /** When false, tool is omitted from model tool list. */
  enabled: boolean;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
};

export type ToolInvocationResult = {
  toolCallId: string;
  name: string;
  ok: boolean;
  result: unknown;
  error?: string;
  durationMs: number;
};

export type ToolLoopOptions = {
  maxRounds?: number;
  /** Inject server tools even if client did not send `tools`. Default true when tools enabled. */
  autoInject?: boolean;
  /**
   * Explicit allowlist of builtin tool names (`tool_names` on the request).
   * When set, only these enabled builtins are injected.
   */
  toolNames?: Array<ToolName | string>;
};

/** How tools were resolved for a completion request. */
export type ToolSelectionResult = {
  /** OpenAI tool defs to send to the model (server builtins ± client tools). */
  tools: OpenAiToolDefinition[];
  /** Whether any server tools were included. */
  serverToolsEnabled: boolean;
  /** Names requested but not known/enabled. */
  unknownToolNames: string[];
  /** Effective server tool names included. */
  selectedToolNames: string[];
};

export type OpenAiToolsPayload = OpenAiToolDefinition[];
