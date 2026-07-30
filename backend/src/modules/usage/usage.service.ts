import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UsageKind,
  UsageRecordEntity,
} from '../../database/entities/usage-record.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { findWithPagination } from '../../common/helpers/typeorm-query.helper';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    @InjectRepository(UsageRecordEntity)
    private readonly repo: Repository<UsageRecordEntity>,
    private readonly config: ConfigService,
  ) {}

  async recordApiHit(input: {
    walletAddress?: string;
    method: string;
    endpoint: string;
    statusCode: number;
    durationMs: number;
    product?: string;
  }): Promise<void> {
    try {
      // Skip noisy health checks
      if (input.endpoint.startsWith('/health') || input.endpoint === '/') {
        return;
      }
      await this.repo.save(
        this.repo.create({
          kind: UsageKind.api,
          walletAddress: input.walletAddress ?? null,
          method: input.method,
          endpoint: input.endpoint.split('?')[0],
          statusCode: input.statusCode,
          durationMs: input.durationMs,
          product: input.product ?? null,
          network: this.config.get<string>('network') ?? null,
        }),
      );
    } catch (e) {
      this.logger.warn(`usage api hit failed: ${(e as Error).message}`);
    }
  }

  async recordAiUsage(input: {
    walletAddress?: string;
    userId?: string;
    product?: string;
    model?: string;
    tokensIn?: number;
    tokensOut?: number;
    costUsdc?: number;
    endpoint?: string;
    metadata?: Record<string, unknown>;
  }): Promise<UsageRecordEntity> {
    return this.repo.save(
      this.repo.create({
        kind: UsageKind.ai,
        walletAddress: input.walletAddress ?? null,
        userId: input.userId ?? null,
        product: input.product ?? null,
        model: input.model ?? null,
        tokensIn: input.tokensIn ?? null,
        tokensOut: input.tokensOut ?? null,
        costUsdc: input.costUsdc ?? null,
        endpoint: input.endpoint ?? null,
        metadata: input.metadata ?? null,
        network: this.config.get<string>('network') ?? null,
      }),
    );
  }

  async list(query: PaginationQueryDto, kind?: UsageKind) {
    return findWithPagination(this.repo, query, {
      where: kind ? { kind } : undefined,
      allowedSort: ['createdAt', 'costUsdc', 'durationMs'],
      searchFields: ['endpoint', 'walletAddress', 'model'],
    });
  }
}
