import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CodeTemplateEntity } from '../../database/entities/code-template.entity';
import { CodeTemplateCloneEntity } from '../../database/entities/code-template-clone.entity';
import { CodeUserEntity } from '../../database/entities/code-user.entity';
import {
  CodeActivityEntity,
  CodeActivityStatus,
} from '../../database/entities/code-activity.entity';
import { CodeUserModelUsageEntity } from '../../database/entities/code-user-model-usage.entity';
import {
  PaymentsService,
  X402GateResult,
  X402SettleError,
} from '../payments/payments.service';
import { UsageService } from '../usage/usage.service';
import { AiService } from '../ai/ai.service';
import {
  PricingService,
} from '../pricing/pricing.service';
import type { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';
import { compilePuyaTsProject } from './puya-compile';
import { ActivitiesService } from '../activities/activities.service';
import { ActivityStatus } from '../../database/entities/activity.entity';
import {
  PaymentProduct,
  RouteKind,
  AiJobType,
  AiJobStatus,
} from '../../common/types/enums';

export type TemplateSort =
  | 'popular'
  | 'newest'
  | 'name'
  | 'clones-asc'
  | 'clones-desc';

/**
 * A paid IDE agent loop. Round 0 gates + settles once; subsequent rounds in
 * the same loop reuse that payment instead of charging again (which previously
 * stalled multi-round agent turns on a second wallet approval).
 */
type PaidAgentSession = {
  walletAddress: string;
  requestId: string;
  priceUsdc: number;
  txId: string;
  roundsUsed: number;
  maxRounds: number;
  createdAt: number;
};

const AGENT_SESSION_TTL_MS = 10 * 60_000;
const AGENT_SESSION_DEFAULT_MAX_ROUNDS = 8;

@Injectable()
export class IdeService {
  constructor(
    @InjectRepository(CodeTemplateEntity)
    private readonly templates: Repository<CodeTemplateEntity>,
    @InjectRepository(CodeTemplateCloneEntity)
    private readonly clones: Repository<CodeTemplateCloneEntity>,
    @InjectRepository(CodeUserEntity)
    private readonly codeUsers: Repository<CodeUserEntity>,
    @InjectRepository(CodeActivityEntity)
    private readonly activities: Repository<CodeActivityEntity>,
    @InjectRepository(CodeUserModelUsageEntity)
    private readonly modelUsage: Repository<CodeUserModelUsageEntity>,
    private readonly payments: PaymentsService,
    private readonly usage: UsageService,
    private readonly ai: AiService,
    private readonly pricing: PricingService,
    private readonly appActivities: ActivitiesService,
  ) {}

  /** Session-id → paid agent loop. Kept in memory (single-instance gateway). */
  private readonly agentSessions = new Map<string, PaidAgentSession>();

  private sweepExpiredAgentSessions(now = Date.now()) {
    for (const [id, s] of this.agentSessions) {
      if (now - s.createdAt > AGENT_SESSION_TTL_MS) {
        this.agentSessions.delete(id);
      }
    }
  }

  private getAgentSession(sessionId: string, walletAddress?: string) {
    this.sweepExpiredAgentSessions();
    const s = this.agentSessions.get(sessionId);
    if (!s) return null;
    if (walletAddress && s.walletAddress !== walletAddress) return null;
    if (Date.now() - s.createdAt > AGENT_SESSION_TTL_MS) {
      this.agentSessions.delete(sessionId);
      return null;
    }
    if (s.roundsUsed >= s.maxRounds) {
      this.agentSessions.delete(sessionId);
      return null;
    }
    return s;
  }

  private createAgentSession(input: {
    sessionId: string;
    walletAddress: string;
    requestId?: string;
    priceUsdc: number;
    txId: string;
    maxRounds: number;
  }) {
    this.sweepExpiredAgentSessions();
    this.agentSessions.set(input.sessionId, {
      walletAddress: input.walletAddress,
      requestId: input.requestId ?? '',
      priceUsdc: input.priceUsdc,
      txId: input.txId,
      roundsUsed: 1,
      maxRounds: input.maxRounds,
      createdAt: Date.now(),
    });
  }

  async ensureCodeUser(address: string): Promise<CodeUserEntity> {
    let user = await this.codeUsers.findOne({ where: { address } });
    if (!user) {
      user = await this.codeUsers.save(
        this.codeUsers.create({ id: address, address }),
      );
    }
    return user;
  }

  async listTemplates(input: {
    q?: string;
    category?: string;
    sort?: TemplateSort;
    includeArchived?: boolean;
  }) {
    const sort = input.sort ?? 'popular';
    const qb = this.templates.createQueryBuilder('t');
    if (!input.includeArchived) {
      qb.andWhere('t.archivedAt IS NULL');
    }
    if (input.q?.trim()) {
      qb.andWhere(
        '(t.name ILIKE :q OR t.description ILIKE :q OR t.slug ILIKE :q)',
        { q: `%${input.q.trim()}%` },
      );
    }
    if (input.category?.trim()) {
      qb.andWhere('t.category = :category', {
        category: input.category.trim(),
      });
    }
    switch (sort) {
      case 'newest':
        qb.orderBy('t.createdAt', 'DESC');
        break;
      case 'name':
        qb.orderBy('t.name', 'ASC');
        break;
      case 'clones-asc':
        qb.orderBy('t.clonedCount', 'ASC');
        break;
      case 'clones-desc':
        qb.orderBy('t.clonedCount', 'DESC');
        break;
      case 'popular':
      default:
        qb.orderBy('t.featured', 'DESC').addOrderBy('t.clonedCount', 'DESC');
        break;
    }
    const rows = await qb.getMany();
    const categories = [
      ...new Set(rows.map((r) => r.category).filter(Boolean)),
    ].sort();
    const templates = await Promise.all(
      rows.map(async (t) => {
        const item = this.toListItem(t);
        const priced = await this.pricing.resolveAmountForTemplate(t.slug, {
          slug: t.slug,
        });
        return {
          ...item,
          priceUsdc: priced.amount,
          priceSource: priced.source,
        };
      }),
    );
    return {
      templates,
      categories,
    };
  }

  private toListItem(t: CodeTemplateEntity) {
    const files = Array.isArray(t.files) ? t.files : [];
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      category: t.category,
      projectName: t.projectName,
      activePath: t.activePath,
      clonedCount: t.clonedCount,
      featured: t.featured,
      fileCount: files.length,
      archivedAt: t.archivedAt?.toISOString() ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  private toDetail(t: CodeTemplateEntity) {
    const files = Array.isArray(t.files) ? t.files : [];
    return {
      ...this.toListItem(t),
      files,
    };
  }

  private async findTemplateEntity(
    idOrSlug: string,
    opts?: { allowArchived?: boolean },
  ): Promise<CodeTemplateEntity> {
    const row = await this.templates.findOne({
      where: [{ id: idOrSlug }, { slug: idOrSlug }],
    });
    if (!row) throw new NotFoundException('Template not found');
    if (!opts?.allowArchived && row.archivedAt) {
      throw new NotFoundException('Template not found');
    }
    return row;
  }

  async getTemplate(idOrSlug: string) {
    const row = await this.findTemplateEntity(idOrSlug);
    const priced = await this.pricing.resolveAmountForTemplate(row.slug, {
      slug: row.slug,
    });
    return {
      template: {
        ...this.toDetail(row),
        priceUsdc: priced.amount,
        priceSource: priced.source,
      },
    };
  }

  async createTemplate(dto: CreateTemplateDto) {
    const existing = await this.templates.findOne({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new BadRequestException(`Template slug "${dto.slug}" already exists`);
    }
    const row = await this.templates.save(
      this.templates.create({
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        category: dto.category ?? 'starter',
        projectName: dto.projectName,
        activePath: dto.activePath,
        files: dto.files,
        featured: dto.featured ?? false,
        archivedAt: null,
      }),
    );
    return { template: this.toDetail(row) };
  }

  async updateTemplate(idOrSlug: string, dto: UpdateTemplateDto) {
    const row = await this.findTemplateEntity(idOrSlug, {
      allowArchived: true,
    });
    if (dto.slug && dto.slug !== row.slug) {
      const clash = await this.templates.findOne({ where: { slug: dto.slug } });
      if (clash) {
        throw new BadRequestException(`Template slug "${dto.slug}" already exists`);
      }
      row.slug = dto.slug;
    }
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.category !== undefined) row.category = dto.category;
    if (dto.projectName !== undefined) row.projectName = dto.projectName;
    if (dto.activePath !== undefined) row.activePath = dto.activePath;
    if (dto.files !== undefined) row.files = dto.files;
    if (dto.featured !== undefined) row.featured = dto.featured;
    const saved = await this.templates.save(row);
    return { template: this.toDetail(saved) };
  }

  async archiveTemplate(idOrSlug: string) {
    const row = await this.findTemplateEntity(idOrSlug, {
      allowArchived: true,
    });
    if (!row.archivedAt) {
      row.archivedAt = new Date();
      await this.templates.save(row);
    }
    return { template: this.toDetail(row) };
  }

  async unarchiveTemplate(idOrSlug: string) {
    const row = await this.findTemplateEntity(idOrSlug, {
      allowArchived: true,
    });
    row.archivedAt = null;
    await this.templates.save(row);
    return { template: this.toDetail(row) };
  }

  async cloneTemplate(input: {
    templateId?: string;
    id?: string;
    slug?: string;
    paymentHeader?: string;
    walletAddress?: string;
    requestId?: string;
  }) {
    const key = input.templateId || input.id || input.slug;
    if (!key) throw new NotFoundException('templateId required');
    const template = await this.findTemplateEntity(key);
    const { amount: priceUsdc } = await this.pricing.resolveAmountForTemplate(
      template.slug,
      { slug: template.slug },
    );

    const gate = await this.payments.gatePaidRequest({
      priceUsdc,
      routeKey: 'POST /api/v1/clone',
      path: '/api/v1/clone',
      product: PaymentProduct.code,
      routeKind: RouteKind.clone,
      description: `Algorand TypeScript template ${template.slug}, including source files and project configuration ready to open in Micropay IDE.`,
      paymentHeader: input.paymentHeader,
      body: {
        templateId: input.templateId,
        id: input.id,
        slug: input.slug,
      },
      walletAddress: input.walletAddress,
      requestId: input.requestId,
    });

    if (!gate.ok) {
      return {
        paymentRequired: true as const,
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
          paymentRequired: true as const,
          status: 402,
          body: {
            error: { message: e.message, type: 'settlement_failed' },
          },
          headers: e.headers,
        };
      }
      throw e;
    }

    await this.clones.save(
      this.clones.create({
        templateId: template.id,
        walletAddress: input.walletAddress ?? null,
        txId,
        costUsdc: gate.priceUsdc,
      }),
    );
    await this.appActivities.record({
      walletAddress: input.walletAddress,
      modelSlug: template.slug,
      modelName: template.name,
      type: 'IDE',
      costUsdc: gate.priceUsdc,
      status: ActivityStatus.settled,
      txId,
      requestId: input.requestId,
    });
    template.clonedCount += 1;
    await this.templates.save(template);

    return {
      paymentRequired: false as const,
      template: this.toDetail(template),
      costUsdc: gate.priceUsdc,
      credit: gate.credit,
      txId,
      paymentHeaders,
    };
  }

  /**
   * IDE agent — payment gate + provider completion (sync) or async AiJob.
   * Injects active IDE knowledge docs into system context when present.
   *
   * A client may run a multi-round tool loop. Round 0 (`round` absent or 0)
   * is gated + settled once and a paid session is recorded under
   * `agentSessionId`. Later rounds that carry the same session id skip the
   * payment gate (already paid) and are capped at `maxRounds`.
   */
  async runAgent(input: {
    body: Record<string, unknown>;
    paymentHeader?: string;
    walletAddress?: string;
    requestId?: string;
    asyncOnly?: boolean;
  }) {
    this.ai.assertRouterConfigured();
    const model = String(input.body.model ?? '');
    const sessionId =
      typeof input.body.agentSessionId === 'string'
        ? input.body.agentSessionId.trim()
        : '';
    const round = Number(input.body.agentRound ?? 0);
    const maxRounds =
      typeof input.body.agentMaxRounds === 'number' &&
      input.body.agentMaxRounds > 0
        ? Math.min(Math.floor(input.body.agentMaxRounds), 12)
        : AGENT_SESSION_DEFAULT_MAX_ROUNDS;
    const continuation =
      Boolean(sessionId) &&
      round > 0 &&
      Number.isFinite(round) &&
      input.walletAddress
        ? this.getAgentSession(sessionId, input.walletAddress)
        : null;

    const { amount: priceUsdc } = await this.pricing.resolveAmount(
      model || 'unknown',
    );

    let gate: X402GateResult | null = null;
    if (continuation) {
      // Already paid on round 0 — reuse the charge, no new x402 gate.
      gate = {
        ok: true,
        payTo: '',
        priceUsdc: continuation.priceUsdc,
        paymentPayload: {} as never,
        paymentRequirements: {} as never,
        credit: {
          allowanceUsdc: 0,
          usedUsdc: 0,
          remainingUsdc: 0,
          listPriceUsdc: continuation.priceUsdc,
          creditAppliedUsdc: 0,
          chargeUsdc: 0,
          resetsAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
        settle: async () => ({
          headers: {
            'X-Credit-Applied': '0',
            'X-Credit-Remaining': '0',
            'X-Agent-Session-Id': sessionId,
          },
          txId: continuation.txId,
        }),
      };
    } else {
      gate = await this.payments.gatePaidRequest({
        priceUsdc,
        routeKey: 'POST /api/v1/ide/agent',
        path: '/api/v1/ide/agent',
        product: PaymentProduct.code,
        routeKind: RouteKind.ide,
        description: `Algorand TypeScript IDE assistance from ${model}, returning code guidance with project file and compile tool support.`,
        paymentHeader: input.paymentHeader,
        body: input.body,
        walletAddress: input.walletAddress,
        requestId: input.requestId,
      });
    }

    if (!gate.ok) {
      return {
        paymentRequired: true as const,
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
          paymentRequired: true as const,
          status: 402,
          body: {
            error: { message: e.message, type: 'settlement_failed' },
          },
          headers: e.headers,
        };
      }
      throw e;
    }

    if (sessionId && input.walletAddress) {
      const existing = this.getAgentSession(sessionId, input.walletAddress);
      if (existing) {
        existing.roundsUsed += 1;
      } else if (!continuation) {
        this.createAgentSession({
          sessionId,
          walletAddress: input.walletAddress,
          requestId: input.requestId,
          priceUsdc: gate.priceUsdc,
          txId,
          maxRounds,
        });
      }
    }

    if (input.walletAddress) {
      const ledgerCostUsdc = continuation ? 0 : gate.priceUsdc;
      const user = await this.ensureCodeUser(input.walletAddress);
      await this.activities.save(
        this.activities.create({
          userId: user.id,
          walletAddress: input.walletAddress,
          modelSlug: model || 'unknown',
          modelName: model || 'unknown',
          type: 'IDE',
          costUsdc: ledgerCostUsdc,
          status: CodeActivityStatus.settled,
          txId,
        }),
      );
      await this.appActivities.record({
        walletAddress: input.walletAddress,
        modelSlug: model || 'unknown',
        modelName: model || 'unknown',
        type: 'IDE',
        costUsdc: ledgerCostUsdc,
        status: ActivityStatus.settled,
        txId,
        requestId: input.requestId,
      });
      await this.recordModelUsage(user.id, model || 'unknown');
      await this.usage.recordAiUsage({
        walletAddress: input.walletAddress,
        userId: user.id,
        product: 'code',
        model,
        costUsdc: ledgerCostUsdc,
        endpoint: '/api/v1/ide/agent',
      });
    }

    const wantsAsync =
      input.asyncOnly ||
      input.body.async === true ||
      input.body.async === 1 ||
      input.body.async === '1';

    if (wantsAsync) {
      const {
        async: _a,
        agentSessionId: _s,
        agentRound: _r,
        agentMaxRounds: _m,
        ...jobBody
      } = input.body;
      const job = await this.ai.createJob({
        type: AiJobType.ide_agent,
        walletAddress: input.walletAddress,
        product: PaymentProduct.code,
        model,
        payload: jobBody,
      });
      return {
        paymentRequired: false as const,
        status: 202,
        body: {
          jobId: job.id,
          status: AiJobStatus.queued,
          type: AiJobType.ide_agent,
          micropay_credit: gate.credit,
        },
        paymentHeaders,
      };
    }

    const {
      agentSessionId: _s,
      agentRound: _r,
      agentMaxRounds: _m,
      ...providerBody
    } = input.body;
    const enrichedBody = await this.ai.enrichIdeAgentBody(providerBody);

    try {
      const completion = await this.ai.proxyChatCompletion({
        ...enrichedBody,
        stream: false,
      });
      return {
        paymentRequired: false as const,
        status: completion.status,
        body: {
          ...completion.data,
          micropay_credit: gate.credit,
        },
        paymentHeaders,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        paymentRequired: false as const,
        status: 502,
        body: {
          error: {
            message,
            type: 'router_error',
          },
        },
        paymentHeaders,
      };
    }
  }

  private async recordModelUsage(userId: string, modelSlug: string) {
    const existing = await this.modelUsage.findOne({
      where: { userId, modelSlug },
    });
    if (existing) {
      existing.useCount += 1;
      existing.lastUsedAt = new Date();
      existing.modelName = modelSlug;
      await this.modelUsage.save(existing);
      return;
    }
    await this.modelUsage.save(
      this.modelUsage.create({
        userId,
        modelSlug,
        modelName: modelSlug,
        useCount: 1,
        lastUsedAt: new Date(),
      }),
    );
  }

  async compile(input: {
    source?: string;
    files?: Array<{ path: string; content: string }>;
    entry?: string;
  }) {
    const sourceBytes = input.source
      ? Buffer.byteLength(input.source, 'utf8')
      : (input.files ?? []).reduce(
          (n, f) => n + Buffer.byteLength(f.content, 'utf8'),
          0,
        );
    if (sourceBytes > 500 * 1024) {
      return {
        ok: false as const,
        status: 422,
        body: {
          error: {
            message: 'Source too large',
            type: 'validation_error',
          },
        },
      };
    }

    const fileMap: Record<string, string> = {};
    if (input.files?.length) {
      for (const f of input.files) {
        if (f.path && typeof f.content === 'string') {
          fileMap[f.path.replace(/\\/g, '/')] = f.content;
        }
      }
    } else if (input.source) {
      fileMap['contract.algo.ts'] = input.source;
    }

    const result = await compilePuyaTsProject({
      files: fileMap,
      entry: input.entry,
    });
    return { ...result, ok: result.ok };
  }

  /** Admin list — includes archived when requested. */
  async adminListTemplates(includeArchived = true) {
    return this.listTemplates({ includeArchived, sort: 'newest' });
  }
}
