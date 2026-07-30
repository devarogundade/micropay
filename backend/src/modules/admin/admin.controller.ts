import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { AdminApiKeyGuard } from '../auth/admin-api-key.guard';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ok, paginated } from '../../common/dto/api-response.dto';
import { SettingsService } from '../settings/settings.service';
import { PricingService } from '../pricing/pricing.service';
import { PricingProduct } from '../../database/entities/pricing-rule.entity';
import { SetModelPriceDto, SetTemplatePriceDto } from '../pricing/dto/pricing.dto';
import { UsageService } from '../usage/usage.service';
import { IdeService } from '../ide/ide.service';
import { AiService } from '../ai/ai.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
} from '../ide/dto/template.dto';

class UpsertSettingDto {
  @IsString()
  key!: string;

  value!: unknown;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  public?: boolean;
}

@Controller('api/v1/admin')
@UseGuards(AdminApiKeyGuard)
export class AdminController {
  constructor(
    private readonly settings: SettingsService,
    private readonly pricing: PricingService,
    private readonly usage: UsageService,
    private readonly ide: IdeService,
    private readonly ai: AiService,
  ) {}

  // ── Settings ──────────────────────────────────────────────
  @Get('settings')
  async listSettings(
    @Query() query: PaginationQueryDto,
    @Query('category') category?: string,
  ) {
    const result = await this.settings.list(query, category);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get('settings/:key')
  async getSetting(@Param('key') key: string) {
    return ok(await this.settings.getByKey(key));
  }

  @Post('settings')
  async upsertSetting(@Body() body: UpsertSettingDto) {
    return ok(await this.settings.upsert(body));
  }

  @Delete('settings/:key')
  async deleteSetting(@Param('key') key: string) {
    return ok(await this.settings.remove(key));
  }

  // ── Pricing (per model) ───────────────────────────────────
  @Get('pricing')
  async listPricing(
    @Query() query: PaginationQueryDto,
    @Query('product') product?: PricingProduct,
    @Query('withModels') withModels?: string,
  ) {
    const result = await this.pricing.list(query, product);
    const payload: Record<string, unknown> = {
      ...paginated(result.items, result.total, result.page, result.limit),
      defaultAmount: this.pricing.getDefaultAmount(),
    };

    if (withModels === '1' || withModels === 'true') {
      try {
        const catalog = await this.ai.listModels(false);
        payload.models = catalog;
      } catch {
        payload.models = null;
        payload.modelsError = 'Catalog unavailable';
      }
    }
    return payload;
  }

  // Template routes MUST be declared before `pricing/:modelId`
  @Get('pricing/templates')
  async listTemplatePricing() {
    const rules = await this.pricing.listTemplateRules();
    const items = await Promise.all(
      rules.map(async (rule) => {
        const slug =
          (rule.metadata?.slug as string | undefined) ||
          rule.modelSlug ||
          rule.key.replace(/^template:/, '');
        const resolved = await this.pricing.resolveAmountForTemplate(slug, {
          slug,
        });
        return {
          slug,
          rule,
          resolvedAmount: resolved.amount,
          source: resolved.source,
        };
      }),
    );
    return ok({
      items,
      defaultAmount: this.pricing.getDefaultAmount(),
    });
  }

  @Get('pricing/templates/:slug')
  async getTemplatePrice(@Param('slug') slug: string) {
    const rule = await this.pricing.getByTemplateSlug(slug);
    const resolved = await this.pricing.resolveAmountForTemplate(slug, {
      slug,
    });
    return ok({
      slug,
      rule,
      resolvedAmount: resolved.amount,
      source: resolved.source,
      defaultAmount: this.pricing.getDefaultAmount(),
    });
  }

  @Put('pricing/templates/:slug')
  async setTemplatePrice(
    @Param('slug') slug: string,
    @Body() body: SetTemplatePriceDto,
  ) {
    return ok(await this.pricing.setTemplatePrice(slug, body));
  }

  @Delete('pricing/templates/:slug')
  async deleteTemplatePrice(@Param('slug') slug: string) {
    return ok(await this.pricing.deleteTemplatePrice(slug));
  }

  @Get('pricing/:modelId')
  async getModelPrice(@Param('modelId') modelId: string) {
    const rule = await this.pricing.getByModelId(modelId);
    const resolved = await this.pricing.resolveAmount(modelId);
    return ok({
      modelId,
      rule,
      resolvedAmount: resolved.amount,
      source: resolved.source,
      defaultAmount: this.pricing.getDefaultAmount(),
    });
  }

  @Put('pricing/:modelId')
  async setModelPricePut(
    @Param('modelId') modelId: string,
    @Body() body: SetModelPriceDto,
  ) {
    return ok(await this.pricing.setModelPrice(modelId, body));
  }

  @Post('pricing/:modelId')
  async setModelPricePost(
    @Param('modelId') modelId: string,
    @Body() body: SetModelPriceDto,
  ) {
    return ok(await this.pricing.setModelPrice(modelId, body));
  }

  /** Legacy create by body (still supported). Prefer PUT :modelId. */
  @Post('pricing')
  async createPricing(@Body() body: SetModelPriceDto & { modelId?: string }) {
    if (body.modelId) {
      return ok(await this.pricing.setModelPrice(body.modelId, body));
    }
    return ok(
      await this.pricing.create({
        key: `custom:${Date.now()}`,
        name: body.name ?? 'Custom rule',
        description: body.description ?? null,
        product: body.product ?? PricingProduct.shared,
        modelSlug: null,
        routeKind: body.routeKind ?? null,
        priceUsdc: body.priceUsdc,
        minUsdc: body.minUsdc ?? null,
        maxUsdc: body.maxUsdc ?? null,
        network: body.network ?? 'both',
        active: body.active ?? true,
        metadata: body.metadata ?? null,
      }),
    );
  }

  @Patch('pricing/by-id/:id')
  async updatePricing(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return ok(await this.pricing.update(id, body as never));
  }

  @Delete('pricing/:modelId')
  async deleteModelPrice(@Param('modelId') modelId: string) {
    // UUID → delete by rule id; otherwise treat as modelId override
    const uuidish =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        modelId,
      );
    if (uuidish) {
      return ok(await this.pricing.remove(modelId));
    }
    return ok(await this.pricing.deleteModelPrice(modelId));
  }

  // ── Templates ─────────────────────────────────────────────
  @Get('templates')
  async listTemplates(@Query('includeArchived') includeArchived?: string) {
    return this.ide.adminListTemplates(
      includeArchived !== '0' && includeArchived !== 'false',
    );
  }

  @Post('templates')
  async createTemplate(@Body() body: CreateTemplateDto) {
    return this.ide.createTemplate(body);
  }

  @Patch('templates/:id')
  async updateTemplate(
    @Param('id') id: string,
    @Body() body: UpdateTemplateDto,
  ) {
    return this.ide.updateTemplate(id, body);
  }

  @Post('templates/:id/archive')
  async archiveTemplate(@Param('id') id: string) {
    return this.ide.archiveTemplate(id);
  }

  @Post('templates/:id/unarchive')
  async unarchiveTemplate(@Param('id') id: string) {
    return this.ide.unarchiveTemplate(id);
  }

  // ── Usage overview ────────────────────────────────────────
  @Get('usage')
  async listUsage(@Query() query: PaginationQueryDto) {
    const result = await this.usage.list(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }
}
