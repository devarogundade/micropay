import { Injectable } from '@nestjs/common';
import {
  ProviderId,
  type AiProvider,
  type ProviderResolveHints,
} from './provider.types';
import { OpenAiProvider } from './openai/openai.provider';
import { AnthropicProvider } from './anthropic/anthropic.provider';
import { ZgRouterProvider } from './zg-router/zg-router.provider';

/**
 * Resolves model → provider. Default production path is the 0G router
 * (OpenAI-compat + Anthropic Messages fallback).
 */
@Injectable()
export class ProviderRegistry {
  constructor(
    private readonly zgRouter: ZgRouterProvider,
    private readonly openai: OpenAiProvider,
    private readonly anthropic: AnthropicProvider,
  ) {}

  /** Primary provider for Micropay inference. */
  defaultProvider(): ZgRouterProvider {
    return this.zgRouter;
  }

  get(id: ProviderId): AiProvider {
    switch (id) {
      case ProviderId.zg_router:
        return this.zgRouter;
      case ProviderId.openai:
        return this.openai;
      case ProviderId.anthropic:
        return this.anthropic;
      default:
        return this.zgRouter;
    }
  }

  /**
   * Route a model to a provider. Prefix / prefer hints can force a vendor;
   * otherwise use ZG router (which itself picks OpenAI vs Anthropic transport).
   */
  resolve(hints: ProviderResolveHints = {}): AiProvider {
    if (hints.prefer) return this.get(hints.prefer);
    const model = (hints.modelId ?? '').toLowerCase();
    if (model.startsWith('anthropic/') || model.startsWith('claude')) {
      // Still go through ZG router so baseURL/API key stay consistent.
      return this.zgRouter;
    }
    return this.zgRouter;
  }

  listIds(): ProviderId[] {
    return [ProviderId.zg_router, ProviderId.openai, ProviderId.anthropic];
  }
}
