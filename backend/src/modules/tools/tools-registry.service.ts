import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { convert as htmlToText } from 'html-to-text';
import { PDFParse } from 'pdf-parse';
import { KnowledgeDocEntity } from '../../database/entities/knowledge-doc.entity';
import { ToolDefEntity } from '../../database/entities/tool-def.entity';
import {
  ToolExecution,
  ToolName,
  ToolScope,
} from '../../common/types/enums';
import type {
  OpenAiToolDefinition,
  RegisteredTool,
  ToolInvocationResult,
} from '../../common/types';
import {
  TOOL_JSON_SCHEMAS,
  currentTimeArgsSchema,
  fetchUrlArgsSchema,
  jsonExtractArgsSchema,
  knowledgeSearchArgsSchema,
  pdfExtractArgsSchema,
  webSearchArgsSchema,
} from './tool-schemas';

@Injectable()
export class ToolsRegistryService {
  private readonly logger = new Logger(ToolsRegistryService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(KnowledgeDocEntity)
    private readonly knowledge: Repository<KnowledgeDocEntity>,
    @InjectRepository(ToolDefEntity)
    private readonly toolDefs: Repository<ToolDefEntity>,
  ) {}

  toolsGloballyEnabled(): boolean {
    return this.config.get<boolean>('tools.enabled') !== false;
  }

  maxRounds(): number {
    const n = Number(this.config.get<number>('tools.maxRounds') ?? 4);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 4;
  }

  private flag(path: string, fallback = true): boolean {
    const v = this.config.get<boolean>(path);
    return v === undefined ? fallback : Boolean(v);
  }

  /** Built-in server tools (OpenAI function-calling). */
  listBuiltinTools(): RegisteredTool[] {
    const tools: RegisteredTool[] = [
      {
        name: ToolName.web_search,
        ...TOOL_JSON_SCHEMAS[ToolName.web_search],
        scope: ToolScope.chat,
        execution: ToolExecution.server,
        enabled:
          this.flag('tools.webSearch.enabled') &&
          Boolean(this.config.get<string>('tools.webSearch.tavilyApiKey')),
        execute: (args) => this.execWebSearch(args),
      },
      {
        name: ToolName.pdf_extract,
        ...TOOL_JSON_SCHEMAS[ToolName.pdf_extract],
        scope: ToolScope.chat,
        execution: ToolExecution.server,
        enabled: this.flag('tools.pdfExtract.enabled'),
        execute: (args) => this.execPdfExtract(args),
      },
      {
        name: ToolName.fetch_url,
        ...TOOL_JSON_SCHEMAS[ToolName.fetch_url],
        scope: ToolScope.chat,
        execution: ToolExecution.server,
        enabled: this.flag('tools.fetchUrl.enabled'),
        execute: (args) => this.execFetchUrl(args),
      },
      {
        name: ToolName.knowledge_search,
        ...TOOL_JSON_SCHEMAS[ToolName.knowledge_search],
        scope: ToolScope.chat,
        execution: ToolExecution.server,
        enabled: this.flag('tools.knowledgeSearch.enabled'),
        execute: (args) => this.execKnowledgeSearch(args),
      },
      {
        name: ToolName.current_time,
        ...TOOL_JSON_SCHEMAS[ToolName.current_time],
        scope: ToolScope.chat,
        execution: ToolExecution.server,
        enabled: this.flag('tools.currentTime.enabled'),
        execute: (args) => this.execCurrentTime(args),
      },
      {
        name: ToolName.json_extract,
        ...TOOL_JSON_SCHEMAS[ToolName.json_extract],
        scope: ToolScope.chat,
        execution: ToolExecution.server,
        enabled: this.flag('tools.jsonExtract.enabled'),
        execute: (args) => this.execJsonExtract(args),
      },
    ];
    return tools;
  }

  /**
   * Tools exposed to the model. ToolDef rows with active=false disable a builtin
   * by name; active ToolDefs with execution=server can add custom stubs later.
   */
  async getEnabledTools(
    scope: ToolScope = ToolScope.chat,
    opts?: { toolNames?: Array<ToolName | string> },
  ): Promise<RegisteredTool[]> {
    if (!this.toolsGloballyEnabled()) return [];

    const builtins = this.listBuiltinTools().filter((t) => t.enabled);
    const defs = await this.toolDefs.find({
      where: [
        { active: true, scope },
        { active: true, scope: ToolScope.general },
      ],
    });
    const disabled = new Set(
      (
        await this.toolDefs.find({
          where: { active: false },
        })
      ).map((d) => d.name),
    );

    const byName = new Map<string, RegisteredTool>();
    for (const t of builtins) {
      if (!disabled.has(t.name)) byName.set(t.name, t);
    }

    // Prefer DB description/parameters overrides for matching builtin names
    for (const def of defs) {
      const existing = byName.get(def.name);
      if (existing) {
        byName.set(def.name, {
          ...existing,
          description: def.description || existing.description,
          parameters: def.parameters?.type
            ? def.parameters
            : existing.parameters,
        });
      }
    }

    let tools = [...byName.values()];
    if (opts?.toolNames && opts.toolNames.length > 0) {
      const allow = new Set(opts.toolNames.map(String));
      tools = tools.filter((t) => allow.has(t.name));
    }
    return tools;
  }

  async toOpenAiTools(
    scope: ToolScope = ToolScope.chat,
    opts?: { toolNames?: Array<ToolName | string> },
  ): Promise<OpenAiToolDefinition[]> {
    const tools = await this.getEnabledTools(scope, opts);
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  /**
   * Resolve tools for a chat completion body.
   *
   * - `tools: null` or `[]` → no tools
   * - `tool_names: string[]` → only those enabled builtins (+ optional client OpenAI tools)
   * - omitted tools/tool_names → all enabled server builtins
   * - OpenAI `tools` with function names (and no tool_names) → filter server tools to those names
   */
  async resolveToolsForRequest(
    body: Record<string, unknown>,
    scope: ToolScope = ToolScope.chat,
  ): Promise<import('../../common/types').ToolSelectionResult> {
    const clientDisabled =
      body.tools === null ||
      (Array.isArray(body.tools) && body.tools.length === 0);

    if (!this.toolsGloballyEnabled() || clientDisabled) {
      return {
        tools: [],
        serverToolsEnabled: false,
        unknownToolNames: [],
        selectedToolNames: [],
      };
    }

    const fromToolNames = Array.isArray(body.tool_names)
      ? (body.tool_names as unknown[]).map((n) => String(n))
      : null;

    const clientTools = Array.isArray(body.tools)
      ? (body.tools as OpenAiToolDefinition[])
      : [];

    const namesFromClientTools =
      fromToolNames == null && clientTools.length > 0
        ? clientTools
            .map((t) => t?.function?.name)
            .filter((n): n is string => Boolean(n))
        : null;

    const allowlist = fromToolNames ?? namesFromClientTools;

    const allEnabled = await this.getEnabledTools(scope);
    const known = new Set(allEnabled.map((t) => t.name));
    const unknownToolNames: string[] = [];

    let selected = allEnabled;
    if (allowlist && allowlist.length > 0) {
      const allow = new Set(allowlist);
      for (const name of allowlist) {
        if (!known.has(name as ToolName) && !known.has(name)) {
          unknownToolNames.push(name);
        }
      }
      selected = allEnabled.filter((t) => allow.has(t.name));
    }

    const serverDefs: OpenAiToolDefinition[] = selected.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    // Server builtins (filtered) + custom client tools (names not in builtins).
    const merged: OpenAiToolDefinition[] = [...serverDefs];
    const serverNames = new Set(serverDefs.map((t) => t.function.name));
    for (const t of clientTools) {
      const name = t?.function?.name;
      if (!name) continue;
      if (known.has(name as ToolName) || known.has(name)) continue;
      if (serverNames.has(name)) continue;
      merged.push(t);
      serverNames.add(name);
    }

    return {
      tools: merged,
      serverToolsEnabled: serverDefs.length > 0,
      unknownToolNames,
      selectedToolNames: selected.map((t) => t.name),
    };
  }

  async executeToolCall(input: {
    id: string;
    name: string;
    argumentsJson: string;
  }): Promise<ToolInvocationResult> {
    const started = Date.now();
    const tools = await this.getEnabledTools(ToolScope.chat);
    const tool = tools.find((t) => t.name === input.name);
    if (!tool) {
      return {
        toolCallId: input.id,
        name: input.name,
        ok: false,
        result: null,
        error: `Unknown or disabled tool: ${input.name}`,
        durationMs: Date.now() - started,
      };
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(input.argumentsJson || '{}') as Record<
        string,
        unknown
      >;
    } catch {
      return {
        toolCallId: input.id,
        name: input.name,
        ok: false,
        result: null,
        error: 'Invalid tool arguments JSON',
        durationMs: Date.now() - started,
      };
    }

    try {
      const result = await tool.execute(parsed);
      return {
        toolCallId: input.id,
        name: input.name,
        ok: true,
        result,
        durationMs: Date.now() - started,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Tool ${input.name} failed: ${message}`);
      return {
        toolCallId: input.id,
        name: input.name,
        ok: false,
        result: null,
        error: message,
        durationMs: Date.now() - started,
      };
    }
  }

  private async execWebSearch(raw: Record<string, unknown>) {
    const args = webSearchArgsSchema.parse(raw);
    const apiKey = this.config.get<string>('tools.webSearch.tavilyApiKey');
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY is not configured');
    }
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: args.query,
        max_results: args.max_results,
        search_depth: 'basic',
        include_answer: false,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        score?: number;
      }>;
      detail?: { error?: string };
      error?: string;
    };
    if (!res.ok) {
      throw new Error(
        data.error ||
          data.detail?.error ||
          `Tavily search failed (${res.status})`,
      );
    }
    return {
      query: args.query,
      results: (data.results ?? []).map((r) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.content ?? '',
        score: r.score,
      })),
    };
  }

  private async execPdfExtract(raw: Record<string, unknown>) {
    const args = pdfExtractArgsSchema.parse(raw);
    let buffer: Buffer;
    if (args.url) {
      const res = await fetch(args.url, {
        headers: { Accept: 'application/pdf,*/*' },
        redirect: 'follow',
      });
      if (!res.ok) {
        throw new Error(`Failed to download PDF (${res.status})`);
      }
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      const b64 = (args.base64 ?? '').replace(/^data:application\/pdf;base64,/, '');
      buffer = Buffer.from(b64, 'base64');
    }

    const parser = new PDFParse({ data: buffer });
    try {
      const textResult = await parser.getText();
      const text = (textResult?.text ?? '').trim();
      const truncated = text.length > args.max_chars;
      return {
        pages: textResult?.pages?.length ?? undefined,
        truncated,
        text: truncated ? text.slice(0, args.max_chars) : text,
      };
    } finally {
      await parser.destroy();
    }
  }

  private async execFetchUrl(raw: Record<string, unknown>) {
    const args = fetchUrlArgsSchema.parse(raw);
    const res = await fetch(args.url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'MicropayBot/1.0 (+https://micropay.website)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) {
      throw new Error(`fetch_url failed (${res.status})`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    const body = await res.text();
    let text: string;
    if (contentType.includes('html') || body.trimStart().startsWith('<')) {
      text = htmlToText(body, {
        wordwrap: false,
        selectors: [
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' },
          { selector: 'script', format: 'skip' },
          { selector: 'style', format: 'skip' },
        ],
      });
    } else {
      text = body;
    }
    const cleaned = text.replace(/\n{3,}/g, '\n\n').trim();
    const truncated = cleaned.length > args.max_chars;
    return {
      url: args.url,
      contentType,
      truncated,
      text: truncated ? cleaned.slice(0, args.max_chars) : cleaned,
    };
  }

  private async execKnowledgeSearch(raw: Record<string, unknown>) {
    const args = knowledgeSearchArgsSchema.parse(raw);
    const q = args.query.trim();
    const rows = await this.knowledge.find({
      where: [
        { active: true, title: ILike(`%${q}%`) },
        { active: true, content: ILike(`%${q}%`) },
        { active: true, slug: ILike(`%${q}%`) },
      ],
      take: args.limit,
      order: { updatedAt: 'DESC' },
    });
    // Deduplicate by id (OR where can overlap)
    const seen = new Set<string>();
    const docs: Array<{
      slug: string;
      title: string;
      scope: string;
      excerpt: string;
      tags: string[] | null;
    }> = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      docs.push({
        slug: r.slug,
        title: r.title,
        scope: r.scope,
        excerpt: r.content.slice(0, 800),
        tags: r.tags,
      });
      if (docs.length >= args.limit) break;
    }
    return { query: q, count: docs.length, docs };
  }

  private async execCurrentTime(raw: Record<string, unknown>) {
    const args = currentTimeArgsSchema.parse(raw);
    const tz = args.timezone || 'UTC';
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        dateStyle: 'full',
        timeStyle: 'long',
      });
      return {
        timezone: tz,
        iso: new Date().toISOString(),
        formatted: formatter.format(new Date()),
      };
    } catch {
      throw new Error(`Invalid timezone: ${tz}`);
    }
  }

  private async execJsonExtract(raw: Record<string, unknown>) {
    const args = jsonExtractArgsSchema.parse(raw);
    let value: unknown;
    try {
      value = JSON.parse(args.json);
    } catch {
      throw new Error('Invalid JSON string');
    }
    if (!args.path) {
      return { value };
    }
    const parts = args.path.split('.').filter(Boolean);
    let cur: unknown = value;
    for (const part of parts) {
      if (cur == null || typeof cur !== 'object') {
        return { path: args.path, value: null, found: false };
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    return { path: args.path, value: cur ?? null, found: cur !== undefined };
  }
}
