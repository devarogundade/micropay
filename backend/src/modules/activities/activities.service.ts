import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ActivityEntity,
  ActivityStatus,
} from '../../database/entities/activity.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { findWithPagination } from '../../common/helpers/typeorm-query.helper';
import { UsersService } from '../users/users.service';

export type UserStats = {
  totalSpendUsdc: number;
  todaySpendUsdc: number;
  totalRequests: number;
  settledRequests: number;
  byType: Array<{ type: string; count: number; spendUsdc: number }>;
};

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(ActivityEntity)
    private readonly repo: Repository<ActivityEntity>,
    private readonly users: UsersService,
  ) {}

  async listForWallet(
    wallet: string,
    query: PaginationQueryDto,
    filters?: { status?: string; type?: string },
  ) {
    const where: {
      walletAddress: string;
      status?: ActivityStatus;
      type?: string;
    } = { walletAddress: wallet };
    if (filters?.status && filters.status !== 'all') {
      where.status = filters.status as ActivityStatus;
    }
    if (filters?.type && filters.type !== 'all') {
      where.type = filters.type;
    }
    return findWithPagination(this.repo, query, {
      where,
      allowedSort: ['createdAt', 'costUsdc'],
      searchFields: ['modelSlug', 'modelName', 'type', 'txId'],
    });
  }

  async record(input: {
    walletAddress?: string;
    modelSlug: string;
    modelName: string;
    type: string;
    costUsdc: number;
    status: ActivityStatus;
    txId: string;
    requestId?: string;
    provider?: string;
    tokensIn?: number;
    tokensOut?: number;
  }) {
    let userId: string | null = null;
    if (input.walletAddress) {
      const user = await this.users.ensureUser(input.walletAddress);
      userId = user.id;
      try {
        await this.users.recordModelUsage({
          walletAddress: input.walletAddress,
          modelSlug: input.modelSlug,
          modelName: input.modelName,
        });
      } catch {
        /* non-fatal */
      }
    }
    return this.repo.save(
      this.repo.create({
        ...input,
        userId,
        walletAddress: input.walletAddress ?? null,
        requestId: input.requestId ?? null,
        provider: input.provider ?? null,
        tokensIn: input.tokensIn ?? null,
        tokensOut: input.tokensOut ?? null,
      }),
    );
  }

  async dailySpend(wallet: string, days = 14) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const rows = await this.repo.find({
      where: {
        walletAddress: wallet,
        status: ActivityStatus.settled,
      },
      select: ['createdAt', 'costUsdc'],
    });
    const filtered = rows.filter((r) => r.createdAt >= since);

    const byDay = new Map<string, number>();
    for (const r of filtered) {
      const key = r.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + (r.costUsdc || 0));
    }

    const now = new Date();
    const out: Array<{ day: string; usdc: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      out.push({
        day: label,
        usdc: Number((byDay.get(key) ?? 0).toFixed(6)),
      });
    }
    return out;
  }

  async statsForWallet(wallet: string): Promise<UserStats> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const all = await this.repo.find({ where: { walletAddress: wallet } });
    const settled = all.filter((r) => r.status === ActivityStatus.settled);
    const today = settled.filter((r) => r.createdAt >= startOfToday);

    const byTypeMap = new Map<string, { count: number; spendUsdc: number }>();
    for (const r of settled) {
      const cur = byTypeMap.get(r.type) ?? { count: 0, spendUsdc: 0 };
      cur.count += 1;
      cur.spendUsdc += r.costUsdc || 0;
      byTypeMap.set(r.type, cur);
    }

    return {
      totalSpendUsdc: Number(
        settled.reduce((s, r) => s + (r.costUsdc || 0), 0).toFixed(6),
      ),
      todaySpendUsdc: Number(
        today.reduce((s, r) => s + (r.costUsdc || 0), 0).toFixed(6),
      ),
      totalRequests: all.length,
      settledRequests: settled.length,
      byType: [...byTypeMap.entries()].map(([type, v]) => ({
        type,
        count: v.count,
        spendUsdc: Number(v.spendUsdc.toFixed(6)),
      })),
    };
  }

  serializeActivity(row: ActivityEntity) {
    return {
      id: row.id,
      modelSlug: row.modelSlug,
      modelName: row.modelName,
      type: row.type,
      costUsdc: row.costUsdc,
      status: row.status,
      txId: row.txId,
      createdAt: row.createdAt.toISOString(),
      walletAddress: row.walletAddress,
      requestId: row.requestId,
      provider: row.provider,
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
    };
  }
}
