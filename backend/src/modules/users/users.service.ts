import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { UserModelUsageEntity } from '../../database/entities/user-model-usage.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(UserModelUsageEntity)
    private readonly modelUsage: Repository<UserModelUsageEntity>,
  ) {}

  async ensureUser(address: string): Promise<UserEntity> {
    let user = await this.users.findOne({ where: { address } });
    if (!user) {
      user = await this.users.save(
        this.users.create({ id: address, address }),
      );
    }
    return user;
  }

  async findByAddress(address: string) {
    return this.users.findOne({ where: { address } });
  }

  async recordModelUsage(input: {
    walletAddress: string;
    modelSlug: string;
    modelName?: string | null;
  }) {
    if (!input.modelSlug) return null;
    const user = await this.ensureUser(input.walletAddress);
    const existing = await this.modelUsage.findOne({
      where: { userId: user.id, modelSlug: input.modelSlug },
    });
    if (existing) {
      existing.useCount += 1;
      existing.lastUsedAt = new Date();
      if (input.modelName) existing.modelName = input.modelName;
      return this.modelUsage.save(existing);
    }
    return this.modelUsage.save(
      this.modelUsage.create({
        userId: user.id,
        modelSlug: input.modelSlug,
        modelName: input.modelName ?? null,
        useCount: 1,
        lastUsedAt: new Date(),
      }),
    );
  }

  async listRecentModelUsage(walletAddress: string, limit = 12) {
    const user = await this.findByAddress(walletAddress);
    if (!user) return [];
    const rows = await this.modelUsage.find({
      where: { userId: user.id },
      order: { lastUsedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 40),
    });
    return rows.map((r) => ({
      modelSlug: r.modelSlug,
      modelName: r.modelName,
      lastUsedAt: r.lastUsedAt.toISOString(),
      useCount: r.useCount,
    }));
  }
}
