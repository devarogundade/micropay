import { Controller, Get, Query } from '@nestjs/common';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { WalletAddress } from '../../common/decorators/wallet-address.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ActivitiesService } from './activities.service';

@Controller('api/v1/activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @SkipTransform()
  @Get()
  async list(
    @WalletAddress() wallet: string | undefined,
    @Query() query: PaginationQueryDto,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('statsOnly') statsOnly?: string,
  ) {
    const emptyStats = {
      totalSpendUsdc: 0,
      todaySpendUsdc: 0,
      totalRequests: 0,
      settledRequests: 0,
      dailyCreditAllowanceUsdc: 0.1,
      dailyCreditUsedUsdc: 0,
      dailyCreditRemainingUsdc: 0.1,
      creditResetsAt: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString(),
      byType: [] as Array<{ type: string; count: number; spendUsdc: number }>,
    };

    if (!wallet) {
      return {
        activities: [],
        dailySpend: [],
        stats: emptyStats,
      };
    }

    if (statsOnly === '1') {
      return { stats: await this.activities.statsForWallet(wallet) };
    }

    // Prefer a generous limit so the app can client-paginate like before.
    if (!query.limit) {
      query.limit = 100;
    }

    const [list, stats, dailySpend] = await Promise.all([
      this.activities.listForWallet(wallet, query, { status, type }),
      this.activities.statsForWallet(wallet),
      this.activities.dailySpend(wallet, 14),
    ]);

    return {
      activities: list.items.map((r) => this.activities.serializeActivity(r)),
      dailySpend,
      page: list.page,
      limit: list.limit,
      total: list.total,
      stats,
    };
  }
}
