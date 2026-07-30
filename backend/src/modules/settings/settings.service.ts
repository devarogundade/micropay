import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingEntity } from '../../database/entities/setting.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { findWithPagination } from '../../common/helpers/typeorm-query.helper';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SettingEntity)
    private readonly repo: Repository<SettingEntity>,
  ) {}

  list(query: PaginationQueryDto, category?: string) {
    return findWithPagination(this.repo, query, {
      where: category ? { category } : undefined,
      searchFields: ['key', 'description'],
      allowedSort: ['key', 'category', 'updatedAt', 'createdAt'],
    });
  }

  async getByKey(key: string) {
    const row = await this.repo.findOne({ where: { key } });
    if (!row) throw new NotFoundException(`Setting ${key} not found`);
    return row;
  }

  async upsert(input: {
    key: string;
    value: unknown;
    description?: string;
    category?: string;
    public?: boolean;
  }) {
    let row = await this.repo.findOne({ where: { key: input.key } });
    if (!row) {
      row = this.repo.create({
        key: input.key,
        value: input.value,
        description: input.description ?? null,
        category: input.category ?? 'general',
        public: input.public ?? true,
      });
    } else {
      row.value = input.value;
      if (input.description !== undefined) row.description = input.description;
      if (input.category !== undefined) row.category = input.category;
      if (input.public !== undefined) row.public = input.public;
    }
    return this.repo.save(row);
  }

  async remove(key: string) {
    const row = await this.getByKey(key);
    await this.repo.remove(row);
    return { deleted: true, key };
  }
}
