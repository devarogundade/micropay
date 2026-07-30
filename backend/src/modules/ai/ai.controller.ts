import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { AiJobType } from '../../database/entities/ai-job.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ok, paginated } from '../../common/dto/api-response.dto';
import { WalletAddress } from '../../common/decorators/wallet-address.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { AiService } from './ai.service';
import { UsersService } from '../users/users.service';

class CreateAiJobDto {
  @IsString()
  type!: AiJobType;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  product?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

@Controller('api/v1')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly users: UsersService,
  ) {}

  @SkipTransform()
  @Get('models')
  async models(@Query('raw') raw?: string) {
    return this.ai.listModels(raw === '1' || raw === 'true');
  }

  @SkipTransform()
  @Get('models/recent')
  async recentModels(
    @WalletAddress() wallet?: string,
    @Query('limit') limit?: string,
  ) {
    if (!wallet) return { usage: [] };
    const usage = await this.users.listRecentModelUsage(
      wallet,
      limit ? Number(limit) : 5,
    );
    return { usage };
  }

  @Post('ai/jobs')
  async createJob(
    @Body() body: CreateAiJobDto,
    @WalletAddress() wallet?: string,
  ) {
    const job = await this.ai.createJob({
      type: body.type,
      model: body.model,
      product: body.product,
      payload: body.payload,
      walletAddress: wallet,
    });
    return ok(job);
  }

  @Get('ai/jobs/:id')
  async getJob(@Param('id') id: string) {
    return ok(await this.ai.getJob(id));
  }

  @Get('ai/knowledge')
  async knowledge(@Query() query: PaginationQueryDto) {
    const result = await this.ai.listKnowledge(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get('ai/tools')
  async tools(
    @Query() query: PaginationQueryDto,
    @Query('scope') scope?: string,
  ) {
    const result = await this.ai.listTools(query, scope);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Post('ai/knowledge/:id/embed')
  async embed(
    @Param('id') id: string,
    @WalletAddress() wallet?: string,
  ) {
    return ok(await this.ai.enqueueEmbed(id, wallet));
  }
}
