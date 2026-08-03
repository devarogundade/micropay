import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { GOPLAUSIBLE_FACILITATOR_URL, X402_CHALLENGE_TAG } from '../../config/networks';

@Controller('.well-known')
export class DiscoveryController {
  constructor(private readonly config: ConfigService) {}

  @SkipTransform()
  @Get('x402.json')
  x402() {
    const api = this.config.get<string>('publicApiUrl') || 'https://api.micropay.website';
    const site = this.config.get<string>('cors.siteUrl') || 'https://micropay.website';
    const app = this.config.get<string>('cors.appUrl') || 'https://app.micropay.website';
    return {
      name: 'Micropay',
      serviceName: 'Micropay AI',
      description: 'Pay-per-use AI and Algorand developer tools settled in USDC through x402.',
      protocol: 'x402',
      version: '2',
      network: 'algorand:mainnet',
      asset: 'USDC',
      facilitator: GOPLAUSIBLE_FACILITATOR_URL,
      tag: X402_CHALLENGE_TAG,
      icon: `${site}/assets/brand/icon.svg`,
      logo: `${site}/assets/brand/logo.svg`,
      homepage: site,
      documentation: `${app}/api-reference`,
      llms: `${site}/llms.txt`,
      mcp: `${api}/mcp`,
      endpoints: [
        ['chat/completions', 'Micropay Chat', 'OpenAI-compatible chat completions with optional SSE streaming.'],
        ['images/generations', 'Micropay Images', 'Generated images returned through persistent downloadable URLs.'],
        ['audio/transcriptions', 'Micropay Audio', 'Speech-to-text transcription returning extracted text.'],
        ['ide/agent', 'Micropay IDE', 'Algorand TypeScript assistance with project and compile tools.'],
        ['clone', 'Micropay Templates', 'Algorand TypeScript template source and project configuration.'],
      ].map(([path, serviceName, description]) => ({
        method: 'POST',
        path: `${api}/api/v1/${path}`,
        serviceName,
        description,
        mimeType: 'application/json',
        tags: ['x402', 'algorand', 'usdc'],
      })),
    };
  }
}
