import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';

const DESCRIPTION =
  'Pay-per-use AI and Algorand developer tools settled in USDC through x402 — chat, images, and audio across popular models.';
const TAGLINE = 'Pay-per-use AI gateway';

@Controller()
export class SiteMetaController {
  constructor(private readonly config: ConfigService) {}

  private origins() {
    const api = this.config.get<string>('publicApiUrl') || 'https://api.micropay.website';
    const site = this.config.get<string>('cors.siteUrl') || 'https://micropay.website';
    const app = this.config.get<string>('cors.appUrl') || 'https://app.micropay.website';
    return { api, site, app };
  }

  /** HTML metadata page — Bazaar/GoPlausible scrapes it for merchant `site` enrichment. */
  @SkipTransform()
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  root() {
    const { api, site, app } = this.origins();
    const title = `Micropay — ${TAGLINE}`;
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#111111" />
    <meta name="color-scheme" content="light" />
    <meta name="application-name" content="Micropay" />
    <meta name="description" content="${DESCRIPTION}" />
    <link rel="icon" href="${site}/assets/brand/icon.svg" type="image/svg+xml" />
    <link rel="icon" href="${site}/assets/brand/icon.png" type="image/png" />
    <link rel="apple-touch-icon" href="${site}/apple-touch-icon.png" />
    <link rel="manifest" href="${site}/site.webmanifest" />
    <link rel="alternate" type="application/json" href="${api}/.well-known/x402" title="x402 merchant card" />
    <link rel="llms-txt" href="${api}/llms.txt" type="text/plain" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Micropay" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${DESCRIPTION}" />
    <meta property="og:url" content="${app}/" />
    <meta property="og:image" content="${site}/assets/brand/og.png" />
    <meta property="og:image:alt" content="Micropay — pay-per-use AI" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${DESCRIPTION}" />
    <meta name="twitter:image" content="${site}/assets/brand/og.png" />
    <title>${title}</title>
  </head>
  <body>
    <main>
      <h1>Micropay</h1>
      <p>${DESCRIPTION}</p>
      <p>Pay with your Algorand wallet in USDC via x402 — no subscriptions or API keys.</p>
      <ul>
        <li>App: <a href="${app}/">${app}</a></li>
        <li>Discovery: <a href="${api}/.well-known/x402">${api}/.well-known/x402</a></li>
        <li>Manifest: <a href="${api}/.well-known/agent.json">${api}/.well-known/agent.json</a></li>
        <li>API reference: <a href="${app}/api-reference">${app}/api-reference</a></li>
      </ul>
    </main>
  </body>
</html>`;
  }

  /** Machine-readable llms.txt — Bazaar agent discovery probes this at the domain root. */
  @SkipTransform()
  @Get('llms.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  llmsTxt() {
    const { api, site, app, code } = {
      ...this.origins(),
      code: this.config.get<string>('cors.codeUrl') || 'https://code.micropay.website',
    };
    return `# Micropay — llms.txt
# Authoritative entry: ${site}
# Paid APIs + MCP: ${app}

> Micropay is a pay-per-use AI gateway on Algorand (x402 / USDC).
> Pay as you go for chat completions, image generation, speech transcription, and an
> Algorand TypeScript IDE assistant. No subscriptions, no API keys — settle in USDC.

## Base URL
${api}

## Discovery (public, no API key)
GET /.well-known/x402          — x402 resource catalog + payment instructions
GET /.well-known/agent.json    — agent manifest (A2A style)
GET /.well-known/x402.json     — legacy x402 merchant card
GET /llms.txt                  — this file
GET ${api}/mcp                 — MCP endpoint

## How to pay
Paid routes return HTTP 402 with Payment-Required + JSON accepts.
Settle through the GoPlausible facilitator, then retry with PAYMENT-SIGNATURE.

## Resources
${this.endpoints().join('\n')}

## More docs
- App / API reference: ${app}/api-reference
- Landing: ${site}
- IDE (puya-ts): ${code}
`;
  }

  private endpoints(): string[] {
    const { api } = this.origins();
    return this.routes().map(
      ([path, name, desc, price]) =>
        `POST ${api}/api/v1/${path} — ${name} — ${desc} (${price} USDC)`,
    );
  }

  private routes(): Array<[string, string, string, string]> {
    return [
      [
        'chat/completions',
        'Micropay Chat',
        'OpenAI-compatible chat completions with optional SSE streaming.',
        '0.1',
      ],
      [
        'images/generations',
        'Micropay Images',
        'Generated images returned through persistent downloadable URLs.',
        '0.1',
      ],
      [
        'audio/transcriptions',
        'Micropay Audio',
        'Speech-to-text transcription returning extracted text.',
        '0.4',
      ],
      [
        'ide/agent',
        'Micropay IDE',
        'Algorand TypeScript assistance with project and compile tools.',
        '0.1',
      ],
      [
        'clone',
        'Micropay Templates',
        'Algorand TypeScript template source and project configuration.',
        '0.1',
      ],
    ];
  }
}