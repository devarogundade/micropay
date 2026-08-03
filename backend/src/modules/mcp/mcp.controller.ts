import { All, Controller, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { AiService } from '../ai/ai.service';
import { IdeService } from '../ide/ide.service';

@Controller('mcp')
export class McpController {
  constructor(
    private readonly ai: AiService,
    private readonly ide: IdeService,
    private readonly config: ConfigService,
  ) {}

  private createServer() {
    const server = new McpServer({ name: 'Micropay', version: '1.0.0' });
    server.registerTool(
      'list_models',
      { description: 'List Micropay AI models with their current per-call USDC prices.' },
      async () => {
        const models = await this.ai.listModels(false);
        return { content: [{ type: 'text', text: JSON.stringify(models, null, 2) }] };
      },
    );
    server.registerTool(
      'micropay_endpoints',
      { description: 'List the paid x402 HTTP resources exposed by Micropay.' },
      async () => {
        const api = this.config.get<string>('publicApiUrl') || 'https://api.micropay.website';
        const endpoints = [
          ['POST', '/api/v1/chat/completions', 'Chat completions with optional streaming'],
          ['POST', '/api/v1/images/generations', 'Generated images persisted to storage'],
          ['POST', '/api/v1/audio/transcriptions', 'Speech-to-text transcription'],
          ['POST', '/api/v1/ide/agent', 'Algorand TypeScript IDE assistance'],
          ['POST', '/api/v1/clone', 'Algorand TypeScript project template'],
        ].map(([method, path, description]) => ({ method, url: `${api}${path}`, description }));
        return { content: [{ type: 'text', text: JSON.stringify(endpoints, null, 2) }] };
      },
    );
    server.registerTool(
      'compile_puya_ts',
      {
        description: 'Compile an Algorand TypeScript project with Puya and return diagnostics and TEAL.',
        inputSchema: {
          source: z.string().max(500_000).optional(),
          files: z.array(z.object({ path: z.string(), content: z.string() })).max(50).optional(),
          entry: z.string().optional(),
        },
      },
      async (input) => {
        const result = await this.ide.compile(input);
        return {
          isError: 'ok' in result && result.ok === false,
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      },
    );
    return server;
  }

  @SkipTransform()
  @All()
  async handle(@Req() request: Request, @Res() response: Response) {
    if (request.method !== 'POST') {
      return response.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Stateless MCP accepts POST requests only.' },
        id: null,
      });
    }
    const server = this.createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } finally {
      await transport.close();
      await server.close();
    }
  }
}
