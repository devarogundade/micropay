import { Module } from '@nestjs/common';
import { OpenAiProvider } from './openai/openai.provider';
import { AnthropicProvider } from './anthropic/anthropic.provider';
import { ZgRouterProvider } from './zg-router/zg-router.provider';
import { ProviderRegistry } from './provider.registry';

@Module({
  providers: [
    OpenAiProvider,
    AnthropicProvider,
    ZgRouterProvider,
    ProviderRegistry,
  ],
  exports: [
    OpenAiProvider,
    AnthropicProvider,
    ZgRouterProvider,
    ProviderRegistry,
  ],
})
export class ProvidersModule {}
