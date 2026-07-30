import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ChatRole, ToolScope } from '../../common/types/enums';
import type {
  ChatCompletionResponse,
  OpenAiChatMessage,
  OpenAiToolCall,
  ToolInvocationResult,
  ToolSelectionResult,
} from '../../common/types';
import { ToolsRegistryService } from './tools-registry.service';

export type ToolAugmentedCompletion = {
  status: number;
  data: ChatCompletionResponse;
  toolInvocations: ToolInvocationResult[];
  usedTools: boolean;
  selection: ToolSelectionResult;
};

/**
 * OpenAI-compatible tool loop via AiService → providers.
 * Non-streaming multi-round; callers may stream only the final answer separately.
 */
@Injectable()
export class ToolsOrchestratorService {
  private readonly logger = new Logger(ToolsOrchestratorService.name);

  constructor(
    private readonly registry: ToolsRegistryService,
    private readonly ai: AiService,
  ) {}

  /**
   * Run chat completion with resolved server tools.
   * If the model returns tool_calls, execute them and continue until a final
   * message or maxRounds.
   */
  async completeWithTools(
    body: Record<string, unknown>,
  ): Promise<ToolAugmentedCompletion> {
    const selection = await this.registry.resolveToolsForRequest(
      body,
      ToolScope.chat,
    );
    const toolInvocations: ToolInvocationResult[] = [];

    if (selection.tools.length === 0) {
      const completion = await this.ai.proxyChatCompletion({
        ...body,
        stream: false,
        tools: undefined,
      });
      return {
        status: completion.status,
        data: completion.data as ChatCompletionResponse,
        toolInvocations,
        usedTools: false,
        selection,
      };
    }

    const messages = this.cloneMessages(body.messages);
    const mergedTools = selection.tools;

    let last: ChatCompletionResponse = {};
    let status = 200;
    const maxRounds = this.registry.maxRounds();

    for (let round = 0; round < maxRounds; round++) {
      const requestBody: Record<string, unknown> = {
        ...body,
        messages,
        tools: mergedTools,
        stream: false,
      };
      if (body.tool_choice === undefined) {
        requestBody.tool_choice = 'auto';
      }

      const completion = await this.ai.proxyChatCompletion(requestBody);
      status = completion.status;
      last = completion.data as ChatCompletionResponse;

      if (status >= 400) {
        return {
          status,
          data: last,
          toolInvocations,
          usedTools: toolInvocations.length > 0,
          selection,
        };
      }

      const message = last.choices?.[0]?.message;
      const toolCalls = message?.tool_calls?.filter(
        (c): c is OpenAiToolCall =>
          Boolean(c?.id && c?.function?.name),
      );

      if (!toolCalls?.length) {
        return {
          status,
          data: last,
          toolInvocations,
          usedTools: toolInvocations.length > 0,
          selection,
        };
      }

      messages.push({
        role: ChatRole.assistant,
        content: message?.content ?? null,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        const invocation = await this.registry.executeToolCall({
          id: call.id,
          name: call.function.name,
          argumentsJson: call.function.arguments ?? '{}',
        });
        toolInvocations.push(invocation);
        messages.push({
          role: ChatRole.tool,
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(
            invocation.ok
              ? invocation.result
              : { error: invocation.error ?? 'tool failed' },
          ),
        });
      }

      this.logger.debug(
        `Tool round ${round + 1}: executed ${toolCalls.map((c) => c.function.name).join(', ')}`,
      );
    }

    const finalBody: Record<string, unknown> = {
      ...body,
      messages,
      tools: mergedTools,
      tool_choice: 'none',
      stream: false,
    };
    const final = await this.ai.proxyChatCompletion(finalBody);
    return {
      status: final.status,
      data: final.data as ChatCompletionResponse,
      toolInvocations,
      usedTools: true,
      selection,
    };
  }

  private cloneMessages(raw: unknown): OpenAiChatMessage[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((m) => {
      const msg = m as OpenAiChatMessage;
      return { ...msg };
    });
  }
}
