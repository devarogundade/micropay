import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'

import { compilePuyaTsSourceWithPuya } from '#/lib/puya-ts-compile.server'
import { getCatalogModels } from '#/lib/zg-catalog'
import { handleMcpRequest } from '#/utils/mcp-handler'

const server = new McpServer({
  name: 'micropay',
  version: '1.0.0',
})

server.registerTool(
  'list_models',
  {
    title: 'List Micropay models',
    description:
      'Return the live Micropay model catalog with USDC display prices.',
    inputSchema: {},
  },
  async () => {
    const catalog = await getCatalogModels()
    if (catalog.error && catalog.models.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${catalog.error}`,
          },
        ],
        isError: true,
      }
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            catalog.models.map((m) => ({
              id: m.routerId ?? m.slug,
              name: m.name,
              type: m.type,
              price_usdc: m.priceUsdc,
              provider: m.provider,
            })),
            null,
            2,
          ),
        },
      ],
    }
  },
)

server.registerTool(
  'micropay_endpoints',
  {
    title: 'Micropay API endpoints',
    description:
      'Describe paywalled Micropay HTTP endpoints (x402 + inference proxy).',
    inputSchema: {
      detail: z
        .boolean()
        .optional()
        .describe('Include curl-style hints'),
    },
  },
  ({ detail }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            base: '/api/v1',
            endpoints: [
              {
                method: 'POST',
                path: '/api/v1/chat/completions',
                x402: true,
                note: 'OpenAI-compatible chat; stream supported',
              },
              {
                method: 'POST',
                path: '/api/v1/images/generations',
                x402: true,
                note: 'b64_json image generation (async)',
              },
              {
                method: 'POST',
                path: '/api/v1/audio/transcriptions',
                x402: true,
                note: 'multipart speech-to-text',
              },
              {
                method: 'POST',
                path: '/api/v1/puya-ts/compile',
                x402: false,
                note: 'Compile Algorand TypeScript (puya-ts) → TEAL; accepts {source} or {files, entry}',
              },
              {
                method: 'POST',
                path: '/api/v1/ide/agent',
                x402: true,
                note: 'Dedicated puya-ts IDE agent with project tools; activity type IDE',
              },
              {
                method: 'GET',
                path: '/api/v1/models',
                x402: false,
              },
            ],
            hint: detail
              ? 'Clients must handle HTTP 402 and retry with PAYMENT-SIGNATURE (see @x402/fetch).'
              : undefined,
          },
          null,
          2,
        ),
      },
    ],
  }),
)

server.registerTool(
  'compile_puya_ts',
  {
    title: 'Compile Algorand TypeScript (puya-ts)',
    description:
      'Compile Algorand TypeScript smart-contract source with puya-ts and return TEAL artifacts / diagnostics. Pass either a single source string or a multi-file map.',
    inputSchema: {
      source: z
        .string()
        .min(1)
        .optional()
        .describe('Single-file Algorand TypeScript (.algo.ts) contract source'),
      files: z
        .record(z.string(), z.string())
        .optional()
        .describe('Multi-file project map: path → source'),
      entry: z
        .string()
        .optional()
        .describe('Entry .algo.ts path when using files'),
    },
  },
  async ({ source, files, entry }) => {
    const { compilePuyaTsProjectWithPuya } = await import(
      '#/lib/puya-ts-compile.server'
    )
    const result = files
      ? await compilePuyaTsProjectWithPuya({ files, entry })
      : await compilePuyaTsSourceWithPuya(source || '')
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.ok,
    }
  },
)

export const Route = createFileRoute('/mcp')({
  server: {
    handlers: {
      POST: async ({ request }) => handleMcpRequest(request, server),
    },
  },
})
