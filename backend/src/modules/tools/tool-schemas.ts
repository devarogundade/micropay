import { z } from 'zod';
import { ToolName } from '../../common/types/enums';

export const webSearchArgsSchema = z.object({
  query: z.string().min(1).max(500),
  max_results: z.number().int().min(1).max(10).optional().default(5),
});

export const pdfExtractArgsSchema = z.object({
  url: z.string().url().optional(),
  base64: z.string().min(1).optional(),
  max_chars: z.number().int().min(500).max(100_000).optional().default(20_000),
}).refine((v) => Boolean(v.url || v.base64), {
  message: 'Provide url or base64',
});

export const fetchUrlArgsSchema = z.object({
  url: z.string().url(),
  max_chars: z.number().int().min(200).max(50_000).optional().default(8_000),
});

export const knowledgeSearchArgsSchema = z.object({
  query: z.string().min(1).max(300),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

export const currentTimeArgsSchema = z.object({
  timezone: z.string().min(1).max(80).optional().default('UTC'),
});

export const jsonExtractArgsSchema = z.object({
  json: z.string().min(1).max(200_000),
  path: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe('Dot path e.g. data.items.0.name'),
});

export type WebSearchArgs = z.infer<typeof webSearchArgsSchema>;
export type PdfExtractArgs = z.infer<typeof pdfExtractArgsSchema>;
export type FetchUrlArgs = z.infer<typeof fetchUrlArgsSchema>;
export type KnowledgeSearchArgs = z.infer<typeof knowledgeSearchArgsSchema>;
export type CurrentTimeArgs = z.infer<typeof currentTimeArgsSchema>;
export type JsonExtractArgs = z.infer<typeof jsonExtractArgsSchema>;

/** JSON Schema fragments for OpenAI tool parameters. */
export const TOOL_JSON_SCHEMAS: Record<
  ToolName,
  { description: string; parameters: Record<string, unknown> }
> = {
  [ToolName.web_search]: {
    description:
      'Search the live web for current information. Returns titles, URLs, and snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        max_results: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Max results (default 5)',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  [ToolName.pdf_extract]: {
    description:
      'Extract text from a PDF given a public URL or base64-encoded PDF bytes.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'HTTP(S) URL to a PDF' },
        base64: {
          type: 'string',
          description: 'Base64-encoded PDF (optionally data: URL)',
        },
        max_chars: {
          type: 'integer',
          description: 'Truncate extracted text to this many characters',
        },
      },
      additionalProperties: false,
    },
  },
  [ToolName.fetch_url]: {
    description:
      'Fetch a web page and return readable plain text (HTML stripped).',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'HTTP(S) URL' },
        max_chars: {
          type: 'integer',
          description: 'Max characters of text to return',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  [ToolName.knowledge_search]: {
    description:
      'Search the Micropay knowledge base (admin-managed docs) by keyword.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 10 },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  [ToolName.current_time]: {
    description: 'Get the current date/time in an IANA timezone.',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'IANA timezone, e.g. America/New_York (default UTC)',
        },
      },
      additionalProperties: false,
    },
  },
  [ToolName.json_extract]: {
    description:
      'Parse a JSON string and optionally extract a value by dot path.',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'string', description: 'Raw JSON text' },
        path: {
          type: 'string',
          description: 'Optional dot path (e.g. choices.0.message.content)',
        },
      },
      required: ['json'],
      additionalProperties: false,
    },
  },
};
