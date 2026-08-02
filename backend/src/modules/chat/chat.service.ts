import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatSessionEntity } from '../../database/entities/chat-session.entity';
import { ChatMessageEntity } from '../../database/entities/chat-message.entity';
import { UsersService } from '../users/users.service';
import { AiService } from '../ai/ai.service';
import {
  PaymentsService,
  X402SettleError,
} from '../payments/payments.service';
import { ActivitiesService } from '../activities/activities.service';
import { UsageService } from '../usage/usage.service';
import { PricingService } from '../pricing/pricing.service';
import { ToolsOrchestratorService } from '../tools/tools-orchestrator.service';
import { ToolsRegistryService } from '../tools/tools-registry.service';
import {
  ActivityKind,
  ActivityStatus,
  AiJobStatus,
  AiJobType,
  PaymentProduct,
  RouteKind,
} from '../../common/types/enums';
import type { IncomingChatMessage } from '../../common/types/chat';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSessionEntity)
    private readonly sessions: Repository<ChatSessionEntity>,
    @InjectRepository(ChatMessageEntity)
    private readonly messages: Repository<ChatMessageEntity>,
    private readonly users: UsersService,
    private readonly ai: AiService,
    private readonly payments: PaymentsService,
    private readonly activities: ActivitiesService,
    private readonly usage: UsageService,
    private readonly pricing: PricingService,
    private readonly toolsOrchestrator: ToolsOrchestratorService,
    private readonly toolsRegistry: ToolsRegistryService,
  ) {}

  private serializeSession(
    row: ChatSessionEntity,
    messageCount?: number,
  ) {
    return {
      id: row.id,
      modelId: row.modelId,
      modelSlug: row.modelSlug,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      ...(messageCount !== undefined ? { messageCount } : {}),
    };
  }

  private serializeMessage(m: ChatMessageEntity) {
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      attachments: m.attachments,
      reasoning: m.reasoning,
      modelId: m.modelId,
      costUsdc: m.costUsdc,
      provider: m.provider,
      error: m.error,
      createdAt: m.createdAt.toISOString(),
    };
  }

  async listSessions(wallet: string, modelId?: string) {
    const user = await this.users.ensureUser(wallet);
    const rows = await this.sessions.find({
      where: {
        userId: user.id,
        ...(modelId ? { modelId } : {}),
      },
      order: { updatedAt: 'DESC' },
      take: 50,
      relations: ['messages'],
    });
    return {
      sessions: rows.map((r) =>
        this.serializeSession(r, r.messages?.length ?? 0),
      ),
    };
  }

  async getLatest(wallet: string, modelId: string) {
    const user = await this.users.ensureUser(wallet);
    const row = await this.sessions.findOne({
      where: { userId: user.id, modelId },
      order: { updatedAt: 'DESC' },
      relations: ['messages'],
    });
    if (!row) return { session: null, messages: [] };
    const messages = [...(row.messages ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return {
      session: this.serializeSession(row),
      messages: messages.map((m) => this.serializeMessage(m)),
    };
  }

  async getSession(wallet: string, sessionId: string) {
    const user = await this.users.ensureUser(wallet);
    const row = await this.sessions.findOne({
      where: { id: sessionId, userId: user.id },
      relations: ['messages'],
    });
    if (!row) return { session: null, messages: [] };
    const messages = [...(row.messages ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return {
      session: this.serializeSession(row),
      messages: messages.map((m) => this.serializeMessage(m)),
    };
  }

  async createSession(input: {
    walletAddress: string;
    modelId: string;
    modelSlug?: string;
    title?: string;
  }) {
    const user = await this.users.ensureUser(input.walletAddress);
    const row = await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        modelId: input.modelId,
        modelSlug: input.modelSlug ?? null,
        title: input.title ?? 'New chat',
      }),
    );
    return this.serializeSession(row, 0);
  }

  async persistTurn(input: {
    walletAddress: string;
    modelId: string;
    modelSlug?: string;
    sessionId?: string | null;
    title?: string;
    messages: IncomingChatMessage[];
  }) {
    const user = await this.users.ensureUser(input.walletAddress);
    let sessionId = input.sessionId ?? null;

    if (sessionId) {
      const existing = await this.sessions.findOne({
        where: { id: sessionId, userId: user.id },
      });
      if (!existing) sessionId = null;
    }

    if (!sessionId) {
      const title =
        input.title ||
        input.messages.find((m) => m.role === 'user')?.content.slice(0, 80) ||
        'Chat';
      const session = await this.createSession({
        walletAddress: input.walletAddress,
        modelId: input.modelId,
        modelSlug: input.modelSlug,
        title,
      });
      sessionId = session.id;
    } else if (input.title) {
      const existing = await this.sessions.findOne({
        where: { id: sessionId, userId: user.id },
      });
      if (
        existing &&
        (!existing.title || existing.title === 'New chat')
      ) {
        existing.title = input.title.slice(0, 80);
        await this.sessions.save(existing);
      }
    }

    const created: ChatMessageEntity[] = [];
    for (const m of input.messages) {
      const row = await this.messages.save(
        this.messages.create({
          ...(m.id ? { id: m.id } : {}),
          sessionId: sessionId!,
          role: m.role,
          content: m.content,
          attachments: m.attachments ?? null,
          reasoning: m.reasoning ?? null,
          modelId: m.modelId ?? null,
          costUsdc: m.costUsdc ?? null,
          provider: m.provider ?? null,
          error: m.error ?? false,
        }),
      );
      created.push(row);
    }
    await this.sessions.update(
      { id: sessionId! },
      { updatedAt: new Date() },
    );

    return {
      sessionId: sessionId!,
      messages: created.map((m) => this.serializeMessage(m)),
    };
  }

  async clearSession(
    wallet: string,
    sessionId: string,
    deleteSession = true,
  ) {
    const user = await this.users.ensureUser(wallet);
    const session = await this.sessions.findOne({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) return { ok: false, sessionId, deleted: false };

    if (deleteSession) {
      await this.sessions.delete({ id: sessionId, userId: user.id });
      return { ok: true, sessionId, deleted: true };
    }

    await this.messages.delete({ sessionId });
    return { ok: true, sessionId, deleted: false, cleared: true };
  }

  private wantsAsync(
    body: Record<string, unknown>,
    asyncHeader?: string,
    asyncQuery?: string,
  ): boolean {
    if (body.async === true || body.async === 1 || body.async === '1') {
      return true;
    }
    if (asyncHeader === '1' || asyncHeader === 'true') return true;
    if (asyncQuery === '1' || asyncQuery === 'true') return true;
    return false;
  }

  async completions(input: {
    body: Record<string, unknown>;
    paymentHeader?: string;
    walletAddress?: string;
    requestId?: string;
    asyncHeader?: string;
    asyncQuery?: string;
  }): Promise<
    | {
        paymentRequired: true;
        status: number;
        body: Record<string, unknown>;
        headers?: Record<string, string>;
      }
    | {
        paymentRequired: false;
        status: number;
        body: Record<string, unknown>;
        paymentHeaders?: Record<string, string>;
      }
    | {
        paymentRequired: false;
        stream: true;
        upstream: globalThis.Response;
        paymentHeaders?: Record<string, string>;
      }
  > {
    this.ai.assertRouterConfigured();
    const model = String(input.body.model ?? '');
    const { amount: priceUsdc } = await this.pricing.resolveAmountForModel(
      model || 'unknown',
    );
    const gate = await this.payments.gatePaidRequest({
      priceUsdc,
      routeKey: 'POST /api/v1/chat/completions',
      path: '/api/v1/chat/completions',
      product: PaymentProduct.app,
      routeKind: RouteKind.chat,
      description: `Chat ${model}`,
      paymentHeader: input.paymentHeader,
      body: input.body,
      walletAddress: input.walletAddress,
      requestId: input.requestId,
    });
    if (!gate.ok) {
      return {
        paymentRequired: true,
        status: gate.status,
        body: gate.body,
        headers: gate.headers,
      };
    }

    let txId = '—';
    let paymentHeaders: Record<string, string> = {};
    try {
      const settled = await gate.settle();
      paymentHeaders = settled.headers;
      txId = settled.txId;
    } catch (e) {
      if (e instanceof X402SettleError) {
        return {
          paymentRequired: true,
          status: 402,
          body: {
            error: { message: e.message, type: 'settlement_failed' },
          },
          headers: e.headers,
        };
      }
      throw e;
    }

    if (input.walletAddress) {
      await this.activities.record({
        walletAddress: input.walletAddress,
        modelSlug: model || 'unknown',
        modelName: model || 'unknown',
        type: ActivityKind.Chat,
        costUsdc: gate.priceUsdc,
        status: ActivityStatus.settled,
        txId,
      });
      await this.usage.recordAiUsage({
        walletAddress: input.walletAddress,
        product: PaymentProduct.app,
        model,
        costUsdc: gate.priceUsdc,
        endpoint: '/api/v1/chat/completions',
      });
    }

    // Preferred primary path: async job + WebSocket
    if (this.wantsAsync(input.body, input.asyncHeader, input.asyncQuery)) {
      const { async: _a, ...jobBody } = input.body;
      const job = await this.ai.createJob({
        type: AiJobType.chat,
        walletAddress: input.walletAddress,
        product: PaymentProduct.app,
        model,
        payload: jobBody,
      });
      return {
        paymentRequired: false,
        status: 202,
        body: {
          jobId: job.id,
          status: AiJobStatus.queued,
          type: AiJobType.chat,
        },
        paymentHeaders,
      };
    }

    const toolsEnabled = this.toolsRegistry.toolsGloballyEnabled();
    const wantStream = Boolean(input.body.stream);
    const clientDisabledTools =
      input.body.tools === null ||
      (Array.isArray(input.body.tools) && input.body.tools.length === 0);
    const explicitlyRequestedTools =
      input.body.tools !== undefined || input.body.tool_names !== undefined;

    // Tool path: non-stream multi-round loop. When client asked for stream,
    // only explicit tools opt into the JSON fallback. Omitted tools on a
    // streaming request must not prevent token-by-token provider output.
    if (
      toolsEnabled &&
      !clientDisabledTools &&
      (!wantStream || explicitlyRequestedTools)
    ) {
      try {
        const result = await this.toolsOrchestrator.completeWithTools(
          input.body,
        );
        const body: Record<string, unknown> = {
          ...result.data,
          micropay_tools: {
            used: result.usedTools,
            selected: result.selection.selectedToolNames,
            unknown: result.selection.unknownToolNames,
            invocations: result.toolInvocations.map((t) => ({
              name: t.name,
              ok: t.ok,
              durationMs: t.durationMs,
              error: t.error,
            })),
          },
        };
        if (result.selection.unknownToolNames.length > 0) {
          body.micropay_warnings = [
            `Unknown or disabled tools ignored: ${result.selection.unknownToolNames.join(', ')}`,
          ];
        }
        if (wantStream && result.usedTools) {
          body.micropay_stream_note =
            'stream=true with tools uses non-stream tool loop; final answer returned as JSON';
        }
        return {
          paymentRequired: false,
          status: result.status,
          body,
          paymentHeaders,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          paymentRequired: false,
          status: 502,
          body: {
            error: { message, type: 'router_error' },
          },
          paymentHeaders,
        };
      }
    }

    if (wantStream) {
      const upstream = await this.ai.proxyChatCompletionStream(input.body);
      return {
        paymentRequired: false,
        stream: true,
        upstream,
        paymentHeaders,
      };
    }

    try {
      const completion = await this.ai.proxyChatCompletion(input.body);
      return {
        paymentRequired: false,
        status: completion.status,
        body: completion.data,
        paymentHeaders,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        paymentRequired: false,
        status: 502,
        body: {
          error: { message, type: 'router_error' },
        },
        paymentHeaders,
      };
    }
  }
}
