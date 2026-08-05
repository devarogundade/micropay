import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingRuleEntity } from '../../database/entities/pricing-rule.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { findWithPagination } from '../../common/helpers/typeorm-query.helper';
import {
  PriceResolveSource,
  PricingKeyType,
  PricingNetworkScope,
  PricingProduct,
} from '../../common/types/enums';
import type { ResolvedPrice, SetPriceInput } from '../../common/types/pricing';
import { SetModelPriceDto, SetTemplatePriceDto } from './dto/pricing.dto';

/**
 * @deprecated Prefer per-template `template:{slug}` pricing.
 * Kept only for reading legacy rules during migration.
 */
export const TEMPLATE_CLONE_MODEL_ID = '__template_clone__';
const MIN_MODEL_PRICE_USDC = 0.05;
const MAX_MODEL_PRICE_USDC = 0.2;

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PricingRuleEntity)
    private readonly repo: Repository<PricingRuleEntity>,
    private readonly config: ConfigService,
  ) {}

  private validAmount(value: unknown, key: string): number {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new InternalServerErrorException({
        code: 'invalid_pricing',
        message: `Pricing rule ${key} has an invalid USDC amount`,
      });
    }
    return amount;
  }

  /** Fallback USDC amount when a model/template has no active PricingRule. */
  getDefaultAmount(): number {
    const n = Number(this.config.get<number | string>('pricing.defaultAmount'));
    return Number.isFinite(n) && n > 0 ? n : MIN_MODEL_PRICE_USDC;
  }

  modelKey(modelId: string): string {
    return `${PricingKeyType.model}:${modelId}`;
  }

  templateKey(slug: string): string {
    return `${PricingKeyType.template}:${slug}`;
  }

  list(query: PaginationQueryDto, product?: PricingProduct) {
    return findWithPagination(this.repo, query, {
      where: product ? { product } : undefined,
      searchFields: ['key', 'name', 'modelSlug', 'routeKind'],
      allowedSort: ['key', 'priceUsdc', 'updatedAt', 'createdAt'],
    });
  }

  /** All active per-model overrides (modelSlug set, key starts with model:). */
  async listModelRules() {
    return this.repo
      .createQueryBuilder('p')
      .where('p.active = true')
      .andWhere('p.modelSlug IS NOT NULL')
      .andWhere("(p.key LIKE 'model:%' OR p.key NOT LIKE 'template:%')")
      .andWhere("p.modelSlug <> :legacy", { legacy: TEMPLATE_CLONE_MODEL_ID })
      .orderBy('p.modelSlug', 'ASC')
      .getMany();
  }

  /** Active template pricing rules (`template:{slug}`). */
  async listTemplateRules() {
    return this.repo
      .createQueryBuilder('p')
      .where('p.active = true')
      .andWhere("p.key LIKE 'template:%'")
      .orderBy('p.key', 'ASC')
      .getMany();
  }

  async getByModelId(modelId: string): Promise<PricingRuleEntity | null> {
    return this.repo.findOne({
      where: [{ key: this.modelKey(modelId) }, { modelSlug: modelId }],
      order: { updatedAt: 'DESC' },
    });
  }

  async getByTemplateSlug(slug: string): Promise<PricingRuleEntity | null> {
    return this.repo.findOne({
      where: [
        { key: this.templateKey(slug) },
        { modelSlug: slug, routeKind: 'clone' },
      ],
      order: { updatedAt: 'DESC' },
    });
  }

  private async resolveByKeyOrSlug(
    slugOrId: string,
    key: string,
    opts?: { network?: string; keyType?: PricingKeyType },
  ): Promise<ResolvedPrice & { rule?: PricingRuleEntity }> {
    const configuredNetwork = this.config.get<string>('network');
    const network =
      opts?.network ??
      (configuredNetwork === PricingNetworkScope.mainnet
        ? PricingNetworkScope.mainnet
        : PricingNetworkScope.testnet);
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.active = true')
      .andWhere('(p.modelSlug = :slugOrId OR p.key = :key)', {
        slugOrId,
        key,
      })
      .andWhere('(p.network = :both OR p.network = :network)', {
        both: PricingNetworkScope.both,
        network,
      })
      .orderBy('CASE WHEN p.network = :network THEN 0 ELSE 1 END', 'ASC')
      .addOrderBy('p.updatedAt', 'DESC');

    const row = await qb.getOne();
    if (row) {
      return {
        amount: this.validAmount(row.priceUsdc, row.key),
        source: PriceResolveSource.rule,
        keyType: opts?.keyType,
        key: row.key,
        rule: row,
      };
    }
    return {
      amount: this.getDefaultAmount(),
      source: PriceResolveSource.default,
      keyType: opts?.keyType,
      key,
    };
  }

  /**
   * Resolve charge amount for a model.
   * Active DB override wins; otherwise DEFAULT_AMOUNT from config.
   */
  async resolveAmount(
    modelId: string,
    opts?: { network?: string },
  ): Promise<ResolvedPrice & { rule?: PricingRuleEntity }> {
    return this.resolveAmountForModel(modelId, opts);
  }

  async resolveAmountForModel(
    modelId: string,
    opts?: { network?: string },
  ): Promise<ResolvedPrice & { rule?: PricingRuleEntity }> {
    const resolved = await this.resolveByKeyOrSlug(modelId, this.modelKey(modelId), {
      ...opts,
      keyType: PricingKeyType.model,
    });
    return {
      ...resolved,
      amount: Math.min(
        MAX_MODEL_PRICE_USDC,
        Math.max(MIN_MODEL_PRICE_USDC, resolved.amount),
      ),
    };
  }

  /**
   * Resolve charge for a code template by id or slug.
   * Looks up `template:{slug}` (and optional legacy `__template_clone__`).
   */
  async resolveAmountForTemplate(
    templateIdOrSlug: string,
    opts?: { network?: string; slug?: string },
  ): Promise<ResolvedPrice & { rule?: PricingRuleEntity }> {
    const slug = opts?.slug ?? templateIdOrSlug;
    const primary = await this.resolveByKeyOrSlug(
      slug,
      this.templateKey(slug),
      { ...opts, keyType: PricingKeyType.template },
    );
    if (primary.source === PriceResolveSource.rule) {
      return primary;
    }

    // Legacy single clone price (migration fallback)
    const legacy = await this.resolveByKeyOrSlug(
      TEMPLATE_CLONE_MODEL_ID,
      this.modelKey(TEMPLATE_CLONE_MODEL_ID),
      { ...opts, keyType: PricingKeyType.model },
    );
    if (legacy.source === PriceResolveSource.rule) {
      return {
        ...legacy,
        keyType: PricingKeyType.template,
        key: this.templateKey(slug),
      };
    }

    return {
      amount: this.getDefaultAmount(),
      source: PriceResolveSource.default,
      keyType: PricingKeyType.template,
      key: this.templateKey(slug),
    };
  }

  /** @deprecated Prefer resolveAmountForModel / resolveAmountForTemplate */
  async resolvePrice(input: {
    modelSlug?: string;
    routeKind?: string;
    network?: string;
  }): Promise<number | null> {
    if (input.modelSlug) {
      const { amount } = await this.resolveAmountForModel(input.modelSlug, {
        network: input.network,
      });
      return amount;
    }
    if (input.routeKind === 'clone') {
      const { amount } = await this.resolveAmountForTemplate(
        TEMPLATE_CLONE_MODEL_ID,
        { network: input.network },
      );
      return amount;
    }
    return this.getDefaultAmount();
  }

  async create(input: Partial<PricingRuleEntity>) {
    return this.repo.save(this.repo.create(input));
  }

  async update(id: string, input: Partial<PricingRuleEntity>) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Pricing rule ${id} not found`);
    Object.assign(row, input);
    return this.repo.save(row);
  }

  async remove(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Pricing rule ${id} not found`);
    await this.repo.remove(row);
    return { deleted: true, id };
  }

  private applyPriceFields(
    row: PricingRuleEntity,
    dto: SetPriceInput,
    defaults: { name: string; modelSlug: string; routeKind?: string | null },
  ) {
    row.priceUsdc = dto.priceUsdc;
    row.modelSlug = defaults.modelSlug;
    if (dto.name !== undefined) row.name = dto.name;
    else if (!row.name) row.name = defaults.name;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.product !== undefined) row.product = dto.product;
    if (dto.routeKind !== undefined) row.routeKind = dto.routeKind;
    else if (defaults.routeKind !== undefined && row.routeKind == null) {
      row.routeKind = defaults.routeKind;
    }
    if (dto.minUsdc !== undefined) row.minUsdc = dto.minUsdc;
    if (dto.maxUsdc !== undefined) row.maxUsdc = dto.maxUsdc;
    if (dto.network !== undefined) row.network = dto.network;
    if (dto.active !== undefined) row.active = dto.active;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
  }

  /** Upsert per-model price (admin). */
  async setModelPrice(modelId: string, dto: SetModelPriceDto) {
    const key = this.modelKey(modelId);
    let row = await this.repo.findOne({ where: { key } });
    if (!row) {
      row = this.repo.create({
        key,
        name: dto.name ?? `Price for ${modelId}`,
        description: dto.description ?? null,
        product: dto.product ?? PricingProduct.shared,
        modelSlug: modelId,
        routeKind: dto.routeKind ?? null,
        priceUsdc: dto.priceUsdc,
        minUsdc: dto.minUsdc ?? null,
        maxUsdc: dto.maxUsdc ?? null,
        network: dto.network ?? PricingNetworkScope.both,
        active: dto.active ?? true,
        metadata: dto.metadata ?? null,
      });
    } else {
      this.applyPriceFields(row, dto, {
        name: `Price for ${modelId}`,
        modelSlug: modelId,
      });
    }
    return this.repo.save(row);
  }

  /** Upsert per-template clone price (admin). Key = `template:{slug}`. */
  async setTemplatePrice(slug: string, dto: SetTemplatePriceDto) {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) {
      throw new NotFoundException('Template slug required');
    }
    const key = this.templateKey(normalized);
    let row = await this.repo.findOne({ where: { key } });
    if (!row) {
      row = this.repo.create({
        key,
        name: dto.name ?? `Template ${normalized}`,
        description: dto.description ?? null,
        product: dto.product ?? PricingProduct.code,
        modelSlug: normalized,
        routeKind: dto.routeKind ?? 'clone',
        priceUsdc: dto.priceUsdc,
        minUsdc: dto.minUsdc ?? null,
        maxUsdc: dto.maxUsdc ?? null,
        network: dto.network ?? PricingNetworkScope.both,
        active: dto.active ?? true,
        metadata: {
          ...(dto.metadata ?? {}),
          keyType: PricingKeyType.template,
          slug: normalized,
        },
      });
    } else {
      this.applyPriceFields(row, dto, {
        name: `Template ${normalized}`,
        modelSlug: normalized,
        routeKind: 'clone',
      });
      row.metadata = {
        ...(row.metadata ?? {}),
        ...(dto.metadata ?? {}),
        keyType: PricingKeyType.template,
        slug: normalized,
      };
    }
    return this.repo.save(row);
  }

  /** Delete per-model override → callers fall back to DEFAULT_AMOUNT. */
  async deleteModelPrice(modelId: string) {
    const row = await this.getByModelId(modelId);
    if (!row) {
      throw new NotFoundException(`No pricing override for model ${modelId}`);
    }
    await this.repo.remove(row);
    return {
      deleted: true,
      modelId,
      defaultAmount: this.getDefaultAmount(),
    };
  }

  async deleteTemplatePrice(slug: string) {
    const row = await this.getByTemplateSlug(slug);
    if (!row) {
      throw new NotFoundException(
        `No pricing override for template ${slug}`,
      );
    }
    await this.repo.remove(row);
    return {
      deleted: true,
      slug,
      defaultAmount: this.getDefaultAmount(),
    };
  }
}
