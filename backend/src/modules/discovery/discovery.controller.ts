import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { GOPLAUSIBLE_FACILITATOR_URL, X402_CHALLENGE_TAG } from '../../config/networks';

@Controller('.well-known')
export class DiscoveryController {
  constructor(private readonly config: ConfigService) {}

  private origins() {
    const api = this.config.get<string>('publicApiUrl') || 'https://api.micropay.website';
    const site = this.config.get<string>('cors.siteUrl') || 'https://micropay.website';
    const app = this.config.get<string>('cors.appUrl') || 'https://app.micropay.website';
    const code = this.config.get<string>('cors.codeUrl') || 'https://code.micropay.website';
    const payTo = this.config.get<string>('x402.payTo') || '';
    return { api, site, app, code, payTo };
  }

  private endpoints() {
    const { api } = this.origins();
    return [
      {
        method: 'POST',
        path: `${api}/api/v1/chat/completions`,
        serviceName: 'Micropay Chat',
        description:
          'OpenAI-compatible chat completions with optional SSE streaming across popular LLM models.',
        priceUsdc: 0.1,
        mimeType: 'application/json',
        tags: ['ai', 'chat', 'llm', 'x402', 'openai-compatible'],
      },
      {
        method: 'POST',
        path: `${api}/api/v1/images/generations`,
        serviceName: 'Micropay Images',
        description:
          'OpenAI-compatible image generation returning generated images through persistent downloadable URLs.',
        priceUsdc: 0.1,
        mimeType: 'application/json',
        tags: ['ai', 'images', 'generation', 'x402', 'openai-compatible'],
      },
      {
        method: 'POST',
        path: `${api}/api/v1/audio/transcriptions`,
        serviceName: 'Micropay Audio',
        description:
          'OpenAI-compatible speech-to-text transcription (multipart audio upload) returning extracted text.',
        priceUsdc: 0.4,
        mimeType: 'application/json',
        tags: ['ai', 'audio', 'transcription', 'x402', 'speech-to-text'],
      },
      {
        method: 'POST',
        path: `${api}/api/v1/ide/agent`,
        serviceName: 'Micropay IDE',
        description:
          'Algorand TypeScript (puya-ts) IDE assistant with project file tools, compile, and deployment guidance.',
        priceUsdc: 0.1,
        mimeType: 'application/json',
        tags: ['ai', 'ide', 'puya-ts', 'x402', 'algorand'],
      },
      {
        method: 'POST',
        path: `${api}/api/v1/clone`,
        serviceName: 'Micropay Templates',
        description:
          'Clone an Algorand TypeScript IDE template source and project configuration into your workspace.',
        priceUsdc: 0.1,
        mimeType: 'application/json',
        tags: ['ide', 'templates', 'puya-ts', 'x402', 'algorand'],
      },
    ];
  }

  private descriptor() {
    const { api, site, app } = this.origins();
    return {
      name: 'Micropay',
      serviceName: 'Micropay AI',
      description:
        'Pay-per-use AI and Algorand developer tools settled in USDC through x402 — chat, images, and audio across popular models.',
      protocol: 'x402',
      version: '2',
      network: 'algorand:mainnet',
      asset: 'USDC',
      facilitator: GOPLAUSIBLE_FACILITATOR_URL,
      tag: X402_CHALLENGE_TAG,
      icon: `${site}/assets/brand/icon.svg`,
      logo: `${site}/assets/brand/logo.svg`,
      homepage: app,
      documentation: `${app}/api-reference`,
      llms: `${api}/llms.txt`,
      mcp: `${api}/mcp`,
      endpoints: this.endpoints().map(({ path, serviceName, description, mimeType, tags }) => ({
        method: 'POST',
        path,
        serviceName,
        description,
        mimeType,
        tags,
      })),
    };
  }

  /** Standard x402 discovery path (Bazaar agent discovery uses /.well-known/x402). */
  @SkipTransform()
  @Get('x402')
  x402() {
    return this.descriptor();
  }

  @SkipTransform()
  @Get('x402.json')
  x402Json() {
    return this.descriptor();
  }

  /** Agent manifest (A2A-style) — enriched into the Bazaar merchant `agent` list. */
  @SkipTransform()
  @Get('agent.json')
  agent() {
    const { api, site, app, code, payTo } = this.origins();
    return {
      did: `did:algorand:${payTo}`,
      name: 'Micropay',
      shortName: 'Micropay',
      version: '1.0.0',
      type: 'Service',
      description:
        'Pay-per-use AI and Algorand developer tools settled in USDC through x402 — chat, images, and audio across popular models at 0.1–0.4 USDC per call.',
      website: site,
      documentation: `${app}/api-reference`,
      agentCardUrl: `${api}/.well-known/agent.json`,
      image: `${site}/assets/brand/logo.svg`,
      walletAddress: payTo,
      protocols: ['x402-v2', 'llms-txt'],
      payment: {
        scheme: 'exact',
        token: 'USDC',
        networks: ['algorand:mainnet'],
        service: 'goplausible',
        discovery: `${api}/.well-known/x402`,
      },
      models: {
        app: app,
        code: code,
      },
      x402Resources: this.endpoints().map(
        ({ path, serviceName, description, priceUsdc }) => ({
          path: path.replace(api, ''),
          name: serviceName,
          summary: description,
          description,
          priceUsdc,
        }),
      ),
    };
  }
}