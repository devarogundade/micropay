import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import {
  AgentEntity,
  AgentStatus,
  AgentType,
} from '../../database/entities/agent.entity';
import { AgentPaymentEntity } from '../../database/entities/agent-payment.entity';
import { CreatorBalanceEntity } from '../../database/entities/creator-balance.entity';
import { WithdrawalRequestEntity } from '../../database/entities/withdrawal.entity';
import {
  ActivityKind,
  ActivityStatus,
  AiJobStatus,
  AiJobType,
  PaymentProduct,
  RouteKind,
  ToolName,
  ToolScope,
  WithdrawalStatus,
} from '../../common/types/enums';
import { PaymentsService, X402SettleError } from '../payments/payments.service';
import { AiService } from '../ai/ai.service';
import { UsersService } from '../users/users.service';
import { ActivitiesService } from '../activities/activities.service';
import { UsageService } from '../usage/usage.service';
import { ImagesService } from '../images/images.service';
import { AudioService } from '../audio/audio.service';
import { ToolsOrchestratorService } from '../tools/tools-orchestrator.service';
import { ToolsRegistryService } from '../tools/tools-registry.service';
import { CreateAgentDto, UpdateAgentDto } from './dto/agent.dto';

const MIN_AGENT_PRICE_USDC = 0.01;
const MAX_AGENT_PRICE_USDC = 10;
const MIN_WITHDRAWAL_USDC = 1;
const MAX_KNOWLEDGE_CHARS = 60_000;

export type AgentCharge = {
  priceUsdc: number;
  creditAppliedUsdc: number;
  chargeUsdc: number;
  txId: string;
};

export type AgentListQuery = {
  q?: string;
  type?: string;
  sort?: string;
  page?: number;
  limit?: number;
  creator?: string;
  status?: string;
};

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agents: Repository<AgentEntity>,
    @InjectRepository(AgentPaymentEntity)
    private readonly payments: Repository<AgentPaymentEntity>,
    @InjectRepository(CreatorBalanceEntity)
    private readonly balances: Repository<CreatorBalanceEntity>,
    @InjectRepository(WithdrawalRequestEntity)
    private readonly withdrawals: Repository<WithdrawalRequestEntity>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly paymentsService: PaymentsService,
    private readonly ai: AiService,
    private readonly users: UsersService,
    private readonly activities: ActivitiesService,
    private readonly usage: UsageService,
    private readonly images: ImagesService,
    private readonly audio: AudioService,
    private readonly toolsOrchestrator: ToolsOrchestratorService,
    private readonly toolsRegistry: ToolsRegistryService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────

  private clampPrice(priceUsdc: number): number {
    const n = Number(priceUsdc);
    if (!Number.isFinite(n) || n <= 0) {
      throw new BadRequestException({
        error: {
          message: 'priceUsdc must be a positive number',
          type: 'validation_error',
        },
      });
    }
    return Math.min(
      MAX_AGENT_PRICE_USDC,
      Math.max(MIN_AGENT_PRICE_USDC, Number(n.toFixed(6))),
    );
  }

  private toMicros(usdc: number): number {
    return Math.round(Number(usdc) * 1_000_000);
  }

  private microsToUsdc(micros: string | number): number {
    const value = Number(micros);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('Creator balance contains an invalid micro-USDC amount');
    }
    return Number((value / 1_000_000).toFixed(6));
  }

  private slugifyName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = this.slugifyName(name) || 'agent';
    for (let attempt = 0; attempt < 6; attempt++) {
      const suffix = randomBytes(3).toString('hex').slice(0, 6);
      const candidate = `${base}-${suffix}`;
      const existing = await this.agents.findOne({
        where: { slug: candidate },
      });
      if (!existing) return candidate;
    }
    return `${base}-${randomBytes(6).toString('hex')}`;
  }

  private serializeAgent(row: AgentEntity) {
    return {
      id: row.id,
      slug: row.slug,
      creatorAddress: row.creatorAddress,
      creatorShort: `${row.creatorAddress.slice(0, 6)}…${row.creatorAddress.slice(-4)}`,
      name: row.name,
      description: row.description,
      type: row.type,
      modelId: row.modelId,
      priceUsdc: row.priceUsdc,
      imageUrl: row.imageUrl,
      systemPrompt: row.systemPrompt,
      knowledge: row.knowledge,
      status: row.status,
      useCount: row.useCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Public detail — hides knowledge/systemPrompt (injected server-side). */
  serializePublic(row: AgentEntity) {
    const serialized = this.serializeAgent(row);
    return {
      ...serialized,
      systemPrompt: undefined,
      knowledge: undefined,
    };
  }

  private buildSystemContent(agent: AgentEntity): string {
    const parts: string[] = [];
    parts.push(`You are "${agent.name}".`);
    if (agent.systemPrompt) parts.push(agent.systemPrompt);
    const entries = Array.isArray(agent.knowledge)
      ? agent.knowledge.filter(
          (k) => k && typeof k.title === 'string' && typeof k.content === 'string',
        )
      : [];
    if (entries.length) {
      parts.push(
        'Use the following knowledge base to answer when it is relevant:',
      );
      let budget = MAX_KNOWLEDGE_CHARS;
      for (const entry of entries) {
        const block = `### ${entry.title}\n${entry.content}`;
        if (budget - block.length <= 0) break;
        parts.push(block);
        budget -= block.length;
      }
    }
    parts.push(
      'Be concise and helpful. If the knowledge base does not contain the answer, say so rather than guessing.',
    );
    return parts.join('\n\n');
  }

  private injectKnowledge(agent: AgentEntity, body: Record<string, unknown>) {
    const systemContent = this.buildSystemContent(agent);
    const messages = Array.isArray(body.messages)
      ? [...(body.messages as Array<Record<string, unknown>>)]
      : [];
    const first = messages[0];
    if (first && first.role === 'system') {
      messages[0] = {
        ...first,
        content: `${String(first.content ?? '')}\n\n${systemContent}`,
      };
    } else {
      messages.unshift({ role: 'system', content: systemContent });
    }
    return messages;
  }

  private activityKindFor(agentType: string): ActivityKind {
    if (agentType === AgentType.image) return ActivityKind.ImageGen;
    if (agentType === AgentType.audio) return ActivityKind.Audio;
    return ActivityKind.Chat;
  }

  private async recordCharge(input: {
    agent: AgentEntity;
    buyerAddress?: string;
    endpoint: string;
    charge: AgentCharge;
  }) {
    const { agent, buyerAddress, endpoint, charge } = input;
    if (charge.chargeUsdc <= 0 && !buyerAddress) return;

    await this.agents.increment({ id: agent.id }, 'useCount', 1);
    await this.creditCreatorBalance(agent.creatorAddress, charge.chargeUsdc);

    if (buyerAddress) {
      await this.payments.save(
        this.payments.create({
          agentId: agent.id,
          agentSlug: agent.slug,
          agentName: agent.name,
          buyerAddress,
          creatorAddress: agent.creatorAddress,
          priceUsdc: charge.priceUsdc,
          creditAppliedUsdc: charge.creditAppliedUsdc,
          chargeUsdc: charge.chargeUsdc,
          txId: charge.txId,
        }),
      );
      await this.activities.record({
        walletAddress: buyerAddress,
        modelSlug: agent.slug,
        modelName: agent.name,
        type: this.activityKindFor(String(agent.type)),
        costUsdc: charge.chargeUsdc,
        status: ActivityStatus.settled,
        txId: charge.txId,
      });
      await this.usage.recordAiUsage({
        walletAddress: buyerAddress,
        product: PaymentProduct.app,
        model: agent.modelId,
        costUsdc: charge.chargeUsdc,
        endpoint,
        metadata: {
          agentId: agent.id,
          agentSlug: agent.slug,
          agentType: agent.type,
          agentName: agent.name,
        },
      });
    }
  }

  private async creditCreatorBalance(
    creatorAddress: string,
    chargeUsdc: number,
  ): Promise<void> {
    const micros = this.toMicros(chargeUsdc);
    if (micros <= 0) return;
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO "CreatorBalance" ("creatorAddress", "balanceMicros", "earnedMicros", "withdrawnMicros") VALUES ($1, $2, $2, 0) ON CONFLICT ("creatorAddress") DO NOTHING`,
        [creatorAddress, micros],
      );
      await manager.query(
        `UPDATE "CreatorBalance" SET "balanceMicros" = "balanceMicros" + $2, "earnedMicros" = "earnedMicros" + $2, "updatedAt" = now() WHERE "creatorAddress" = $1`,
        [creatorAddress, micros],
      );
    });
  }

  private wantsAsync(
    body: Record<string, unknown>,
    asyncHeader?: string,
    asyncQuery?: string,
  ): boolean {
    if (body.async === true || body.async === 1 || body.async === '1') return true;
    if (asyncHeader === '1' || asyncHeader === 'true') return true;
    if (asyncQuery === '1' || asyncQuery === 'true') return true;
    return false;
  }

  // ── Public reads ───────────────────────────────────────────

  async list(query: AgentListQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const qb = this.agents.createQueryBuilder('a');
    qb.where('a.status = :published', { published: AgentStatus.published });
    if (query.type) {
      qb.andWhere('a.type = :type', { type: query.type });
    }
    if (query.creator) {
      qb.andWhere('a.creatorAddress = :creator', { creator: query.creator });
    }
    if (query.q) {
      qb.andWhere(
        '(a.name ILIKE :q OR a.description ILIKE :q OR a.slug ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }
    const sort = query.sort ?? 'recent';
    if (sort === 'price-asc') qb.orderBy('a.priceUsdc', 'ASC');
    else if (sort === 'price-desc') qb.orderBy('a.priceUsdc', 'DESC');
    else if (sort === 'popular') qb.orderBy('a.useCount', 'DESC');
    else qb.orderBy('a.updatedAt', 'DESC');

    const [rows, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: rows.map((r) => this.serializePublic(r)),
      total,
      page,
      limit,
    };
  }

  async getPublic(slug: string): Promise<AgentEntity> {
    const row = await this.agents.findOne({ where: { slug } });
    if (!row || row.status !== AgentStatus.published) {
      throw new NotFoundException({
        error: { message: 'Agent not found', type: 'not_found' },
      });
    }
    return row;
  }

  async getBySlug(slug: string): Promise<AgentEntity> {
    const row = await this.agents.findOne({ where: { slug } });
    if (!row) {
      throw new NotFoundException({
        error: { message: 'Agent not found', type: 'not_found' },
      });
    }
    return row;
  }

  // ── Ownership ──────────────────────────────────────────────

  private async assertOwner(slug: string, creatorAddress: string): Promise<AgentEntity> {
    const row = await this.agents.findOne({ where: { slug } });
    if (!row) {
      throw new NotFoundException({
        error: { message: 'Agent not found', type: 'not_found' },
      });
    }
    if (row.creatorAddress !== creatorAddress) {
      throw new NotFoundException({
        error: { message: 'Agent not found', type: 'not_found' },
      });
    }
    return row;
  }

  async create(wallet: string, dto: CreateAgentDto) {
    await this.users.ensureUser(wallet);
    const priceUsdc = this.clampPrice(dto.priceUsdc);
    const knowledge = Array.isArray(dto.knowledge)
      ? dto.knowledge
          .filter((k) => k && typeof k.title === 'string' && typeof k.content === 'string')
          .map((k) => ({
            title: k.title.slice(0, 500),
            content: k.content.slice(0, MAX_KNOWLEDGE_CHARS),
          }))
      : null;
    const row = await this.agents.save(
      this.agents.create({
        slug: await this.uniqueSlug(dto.name),
        creatorAddress: wallet,
        name: dto.name.slice(0, 120),
        description: dto.description ? dto.description.slice(0, 4000) : null,
        type: dto.type,
        modelId: dto.modelId,
        priceUsdc,
        imageUrl: dto.imageUrl ? dto.imageUrl.slice(0, 2000) : null,
        systemPrompt: dto.systemPrompt ? dto.systemPrompt.slice(0, 8000) : null,
        knowledge,
        status: dto.status === AgentStatus.draft ? AgentStatus.draft : AgentStatus.published,
      }),
    );
    return this.serializeAgent(row);
  }

  async update(wallet: string, slug: string, dto: UpdateAgentDto) {
    const row = await this.assertOwner(slug, wallet);
    if (dto.name !== undefined) row.name = dto.name.slice(0, 120);
    if (dto.description !== undefined) row.description = dto.description ? dto.description.slice(0, 4000) : null;
    if (dto.type !== undefined) row.type = dto.type;
    if (dto.modelId !== undefined) row.modelId = dto.modelId;
    if (dto.priceUsdc !== undefined) row.priceUsdc = this.clampPrice(dto.priceUsdc);
    if (dto.imageUrl !== undefined) row.imageUrl = dto.imageUrl ? dto.imageUrl.slice(0, 2000) : null;
    if (dto.systemPrompt !== undefined) row.systemPrompt = dto.systemPrompt ? dto.systemPrompt.slice(0, 8000) : null;
    if (dto.knowledge !== undefined) {
      row.knowledge = Array.isArray(dto.knowledge)
        ? dto.knowledge
            .filter((k) => k && typeof k.title === 'string' && typeof k.content === 'string')
            .map((k) => ({
              title: k.title.slice(0, 500),
              content: k.content.slice(0, MAX_KNOWLEDGE_CHARS),
            }))
        : null;
    }
    if (dto.status !== undefined) row.status = dto.status;
    await this.agents.save(row);
    return this.serializeAgent(row);
  }

  async setStatus(wallet: string, slug: string, status: AgentStatus) {
    const row = await this.assertOwner(slug, wallet);
    row.status = status;
    await this.agents.save(row);
    return this.serializeAgent(row);
  }

  async remove(wallet: string, slug: string) {
    const row = await this.assertOwner(slug, wallet);
    await this.agents.remove(row);
    return { deleted: true, slug };
  }

  async listMine(wallet: string) {
    const rows = await this.agents.find({
      where: { creatorAddress: wallet },
      order: { updatedAt: 'DESC' },
      take: 200,
    });
    return rows.map((r) => this.serializeAgent(r));
  }

  // ── Prompt execution ───────────────────────────────────────

  async chatCompletions(input: {
    agent: AgentEntity;
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
    const agent = input.agent;
    const priceUsdc = this.clampPrice(agent.priceUsdc);
    const path = `/api/v1/agents/${agent.slug}/chat`;
    const gate = await this.paymentsService.gatePaidRequest({
      priceUsdc,
      routeKey: `POST ${path}`,
      path,
      product: PaymentProduct.app,
      routeKind: RouteKind.agent,
      description: `Paid ${agent.type} agent "${agent.name}" — answers using its knowledge base.`,
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
          body: { error: { message: e.message, type: 'settlement_failed' } },
          headers: e.headers,
        };
      }
      throw e;
    }

    await this.recordCharge({
      agent,
      buyerAddress: input.walletAddress,
      endpoint: path,
      charge: {
        priceUsdc,
        creditAppliedUsdc: gate.credit.creditAppliedUsdc,
        chargeUsdc: gate.priceUsdc,
        txId,
      },
    });

    const messages = this.injectKnowledge(agent, input.body);
    const {
      tools: clientTools,
      tool_names: clientToolNames,
      ...cleanBody
    } = input.body;

    const clientDisabled =
      clientTools === null ||
      (Array.isArray(clientTools) && clientTools.length === 0);
    const explicitNames = Array.isArray(clientToolNames)
      ? (clientToolNames as unknown[]).map(String)
      : null;
    const hasClientTools = Array.isArray(clientTools) && clientTools.length > 0;

    // Online tool (web_search) is enabled by default under the hood so agents
    // can look things up live. Clients can still disable or override tools.
    const effectiveToolNames: string[] | undefined = clientDisabled
      ? undefined
      : explicitNames && explicitNames.length > 0
        ? explicitNames
        : hasClientTools
          ? undefined
          : [ToolName.web_search];

    const availableTools =
      effectiveToolNames && effectiveToolNames.length > 0
        ? await this.toolsRegistry.getEnabledTools(ToolScope.chat, {
            toolNames: effectiveToolNames,
          })
        : [];

    const toolRequestBody: Record<string, unknown> = {
      ...cleanBody,
      model: agent.modelId,
      messages,
    };
    if (effectiveToolNames && effectiveToolNames.length > 0) {
      toolRequestBody.tool_names = effectiveToolNames;
    }
    if (clientTools !== undefined) {
      toolRequestBody.tools = clientTools;
    }

    if (this.wantsAsync(input.body, input.asyncHeader, input.asyncQuery)) {
      const job = await this.ai.createJob({
        type: AiJobType.chat,
        walletAddress: input.walletAddress,
        product: PaymentProduct.app,
        model: agent.modelId,
        payload: toolRequestBody,
      });
      return {
        paymentRequired: false,
        status: 202,
        body: { jobId: job.id, status: AiJobStatus.queued, type: AiJobType.chat },
        paymentHeaders,
      };
    }

    const wantStream = Boolean(input.body.stream);
    // True SSE streaming only when no tools are actually in play.
    if (wantStream && availableTools.length === 0 && !hasClientTools) {
      const upstream = await this.ai.proxyChatCompletionStream(toolRequestBody);
      return { paymentRequired: false, stream: true, upstream, paymentHeaders };
    }

    try {
      const result = await this.toolsOrchestrator.completeWithTools(
        toolRequestBody,
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
        body: { error: { message, type: 'router_error' } },
        paymentHeaders,
      };
    }
  }

  async generateImage(input: {
    agent: AgentEntity;
    body: Record<string, unknown>;
    paymentHeader?: string;
    walletAddress?: string;
    requestId?: string;
    asyncOnly?: boolean;
  }) {
    const agent = input.agent;
    const path = `/api/v1/agents/${agent.slug}/images`;
    return this.images.generate({
      body: { ...input.body, model: agent.modelId },
      paymentHeader: input.paymentHeader,
      walletAddress: input.walletAddress,
      requestId: input.requestId,
      asyncOnly: input.asyncOnly,
      skipActivity: true,
      priceUsdcOverride: this.clampPrice(agent.priceUsdc),
      onCharge: async (charge) => {
        await this.recordCharge({
          agent,
          buyerAddress: input.walletAddress,
          endpoint: path,
          charge,
        });
      },
    });
  }

  async transcribeAudio(input: {
    agent: AgentEntity;
    file?: Express.Multer.File;
    language?: string;
    paymentHeader?: string;
    walletAddress?: string;
    requestId?: string;
    asyncOnly?: boolean;
  }) {
    const agent = input.agent;
    const path = `/api/v1/agents/${agent.slug}/audio`;
    return this.audio.transcribe({
      file: input.file,
      model: agent.modelId,
      language: input.language,
      paymentHeader: input.paymentHeader,
      walletAddress: input.walletAddress,
      requestId: input.requestId,
      asyncOnly: input.asyncOnly,
      skipActivity: true,
      priceUsdcOverride: this.clampPrice(agent.priceUsdc),
      onCharge: async (charge) => {
        await this.recordCharge({
          agent,
          buyerAddress: input.walletAddress,
          endpoint: path,
          charge,
        });
      },
    });
  }

  // ── Creator ledger ─────────────────────────────────────────

  async getBalance(wallet: string) {
    const row = await this.balances.findOne({
      where: { creatorAddress: wallet },
    });
    const pendingRows = await this.withdrawals.find({
      where: {
        creatorAddress: wallet,
        status: WithdrawalStatus.pending,
      },
    });
    const approvedRows = await this.withdrawals.find({
      where: {
        creatorAddress: wallet,
        status: WithdrawalStatus.approved,
      },
    });
    const balanceMicros = row ? Number(row.balanceMicros) : 0;
    const earnedMicros = row ? Number(row.earnedMicros) : 0;
    const withdrawnMicros = row ? Number(row.withdrawnMicros) : 0;
    const pendingMicros = [...pendingRows, ...approvedRows].reduce(
      (sum, w) => sum + Number(w.amountMicros),
      0,
    );
    return {
      availableUsdc: this.microsToUsdc(Math.max(0, balanceMicros - pendingMicros)),
      lifetimeEarnedUsdc: this.microsToUsdc(earnedMicros),
      withdrawnUsdc: this.microsToUsdc(withdrawnMicros),
      pendingWithdrawalsUsdc: this.microsToUsdc(pendingMicros),
      balanceUsdc: this.microsToUsdc(balanceMicros),
      minWithdrawalUsdc: MIN_WITHDRAWAL_USDC,
    };
  }

  async listPayments(wallet: string, page = 1, limit = 20) {
    const take = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;
    const [rows, total] = await this.payments.findAndCount({
      where: { creatorAddress: wallet },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        agentSlug: r.agentSlug,
        agentName: r.agentName,
        buyerAddress: r.buyerAddress,
        priceUsdc: r.priceUsdc,
        creditAppliedUsdc: r.creditAppliedUsdc,
        chargeUsdc: r.chargeUsdc,
        txId: r.txId,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      limit: take,
    };
  }

  async requestWithdrawal(wallet: string, dto: { amountUsdc: number; destinationAddress?: string }) {
    await this.users.ensureUser(wallet);
    const amountUsdc = Number(dto.amountUsdc);
    if (!Number.isFinite(amountUsdc) || amountUsdc < MIN_WITHDRAWAL_USDC) {
      throw new BadRequestException({
        error: {
          message: `Minimum withdrawal is ${MIN_WITHDRAWAL_USDC} USDC`,
          type: 'validation_error',
        },
      });
    }
    const balance = await this.getBalance(wallet);
    if (amountUsdc > balance.availableUsdc) {
      throw new BadRequestException({
        error: {
          message: `Insufficient available balance (${balance.availableUsdc} USDC)`,
          type: 'insufficient_balance',
        },
      });
    }
    const destination =
      dto.destinationAddress && dto.destinationAddress.trim().length > 0
        ? dto.destinationAddress.trim()
        : wallet;
    const row = await this.withdrawals.save(
      this.withdrawals.create({
        creatorAddress: wallet,
        amountMicros: String(this.toMicros(amountUsdc)),
        status: WithdrawalStatus.pending,
        destinationAddress: destination,
        requestedAt: new Date(),
      }),
    );
    return this.serializeWithdrawal(row);
  }

  async listWithdrawals(wallet: string) {
    const rows = await this.withdrawals.find({
      where: { creatorAddress: wallet },
      order: { requestedAt: 'DESC' },
      take: 100,
    });
    return rows.map((r) => this.serializeWithdrawal(r));
  }

  private serializeWithdrawal(row: WithdrawalRequestEntity) {
    return {
      id: row.id,
      amountUsdc: this.microsToUsdc(Number(row.amountMicros)),
      status: row.status,
      destinationAddress: row.destinationAddress,
      txId: row.txId,
      note: row.note,
      requestedAt: row.requestedAt.toISOString(),
      processedAt: row.processedAt ? row.processedAt.toISOString() : null,
    };
  }

  // ── Admin ──────────────────────────────────────────────────

  async adminListAgents(query: AgentListQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const qb = this.agents.createQueryBuilder('a');
    if (query.status) {
      qb.where('a.status = :status', { status: query.status });
    }
    if (query.q) {
      qb.andWhere('(a.name ILIKE :q OR a.slug ILIKE :q OR a.creatorAddress ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }
    qb.orderBy('a.updatedAt', 'DESC');
    const [rows, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return {
      items: rows.map((r) => this.serializeAgent(r)),
      total,
      page,
      limit,
    };
  }

  async adminSetStatus(id: string, status: AgentStatus) {
    const row = await this.agents.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException({ error: { message: 'Agent not found', type: 'not_found' } });
    }
    row.status = status;
    await this.agents.save(row);
    return this.serializeAgent(row);
  }

  async adminListWithdrawals(query: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const qb = this.withdrawals.createQueryBuilder('w');
    if (query.status) qb.where('w.status = :status', { status: query.status });
    qb.orderBy('w.requestedAt', 'DESC');
    const [rows, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return {
      items: rows.map((r) => this.serializeWithdrawal(r)),
      total,
      page,
      limit,
    };
  }

  async adminSetWithdrawalStatus(
    id: string,
    status: WithdrawalStatus,
    meta?: { txId?: string; note?: string },
  ) {
    const row = await this.withdrawals.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException({ error: { message: 'Withdrawal not found', type: 'not_found' } });
    }
    row.status = status;
    row.processedAt = new Date();
    if (meta?.txId) row.txId = meta.txId;
    if (meta?.note !== undefined) row.note = meta.note;

    if (status === WithdrawalStatus.paid) {
      const amount = Number(row.amountMicros);
      await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO "CreatorBalance" ("creatorAddress", "balanceMicros", "earnedMicros", "withdrawnMicros") VALUES ($1, 0, 0, $2) ON CONFLICT ("creatorAddress") DO UPDATE SET "withdrawnMicros" = "withdrawnMicros" + $2, "balanceMicros" = GREATEST(0, "balanceMicros" - $2), "updatedAt" = now()`,
          [row.creatorAddress, amount],
        );
      });
    }

    await this.withdrawals.save(row);
    return this.serializeWithdrawal(row);
  }

  getMinWithdrawalUsdc(): number {
    return MIN_WITHDRAWAL_USDC;
  }
}