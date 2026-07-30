import { Controller, Get, Query } from '@nestjs/common';
import { UsageKind } from '../../database/entities/usage-record.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { paginated } from '../../common/dto/api-response.dto';
import { UsageService } from './usage.service';

@Controller('api/v1/usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Get()
  async list(
    @Query() query: PaginationQueryDto,
    @Query('kind') kind?: UsageKind,
  ) {
    const result = await this.usage.list(query, kind);
    return paginated(result.items, result.total, result.page, result.limit, {
      sort: query.sort,
      order: query.sortOrder,
      search: query.search,
    });
  }
}
