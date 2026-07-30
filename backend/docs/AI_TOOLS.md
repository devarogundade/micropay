# AI chat tools

## Approach

**Native OpenAI-compatible function calling** (`tools` + `tool_calls` on chat completions), orchestrated in Nest (`modules/tools`), executed via the unified **providers** layer (`modules/providers` → ZG router OpenAI/Anthropic).

### Why not other stacks

| Option | Why skipped for now |
|--------|---------------------|
| Vercel AI SDK | Would replace the Nest completion path / streaming adapter |
| LangChain / LangGraph | Heavy; duplicates payment + proxy concerns |
| LlamaIndex | Overkill for a small fixed tool set |
| MCP bridge | Useful later for external tool servers; not required for first-party tools |

Anthropic-format models continue to work because `zg-anthropic.ts` maps OpenAI `tools` ↔ Anthropic `tool_use` inside `AnthropicProvider`.

## Selecting tools on completions

Clients may choose which **server builtins** are available:

| Input | Behavior |
|-------|----------|
| omitted `tools` / `tool_names` | Server defaults: all enabled builtins (env + `ToolDef`) |
| `"tools": null` or `"tools": []` | No tools |
| `"tool_names": ["web_search","pdf_extract"]` | Only those enabled builtins |
| OpenAI `"tools": [{ type:"function", function:{ name:"web_search", ...}}]` | Treat function names as allowlist of server tools (when `tool_names` absent) |

Unknown names are ignored; response includes:

```json
{
  "micropay_tools": { "selected": ["web_search"], "unknown": ["foo"], "invocations": [] },
  "micropay_warnings": ["Unknown or disabled tools ignored: foo"]
}
```

### Examples

```json
POST /api/v1/chat/completions
{
  "model": "gpt-…",
  "messages": [{ "role": "user", "content": "Search for Algorand x402" }],
  "tool_names": ["web_search", "fetch_url"]
}
```

```json
{
  "model": "gpt-…",
  "messages": [{ "role": "user", "content": "What time is it in Tokyo?" }],
  "tools": null
}
```

## Tools

| Name | Provider / lib | Env |
|------|----------------|-----|
| `web_search` | [Tavily](https://tavily.com) Search API | `TAVILY_API_KEY`, `TOOLS_WEB_SEARCH_ENABLED` |
| `pdf_extract` | [`pdf-parse`](https://www.npmjs.com/package/pdf-parse) v2 | `TOOLS_PDF_EXTRACT_ENABLED` |
| `fetch_url` | `fetch` + [`html-to-text`](https://www.npmjs.com/package/html-to-text) | `TOOLS_FETCH_URL_ENABLED` |
| `knowledge_search` | TypeORM `KnowledgeDoc` ILIKE | `TOOLS_KNOWLEDGE_SEARCH_ENABLED` |
| `current_time` | `Intl` | `TOOLS_CURRENT_TIME_ENABLED` |
| `json_extract` | `JSON.parse` + dot path | `TOOLS_JSON_EXTRACT_ENABLED` |

Global: `TOOLS_ENABLED`, `TOOLS_MAX_ROUNDS` (default 4). Enum: `ToolName`.

Parameter validation uses **Zod**. OpenAI tool schemas are exported from `tool-schemas.ts`.

## Async jobs + WebSocket

Preferred path for any AI task after x402 settle:

1. `POST …` with `async: true` / header `x-async: 1` / `?async=1`
2. Response `{ jobId, status: "queued" }`
3. Client joins Socket.IO `/realtime`, `subscribeJob { jobId }`
4. Events: `job.progress`, `job.completed`, `job.failed` on rooms `job:{id}` and `wallet:{address}`

| Modality | Async trigger | Queue |
|----------|---------------|-------|
| Chat | `async` / `x-async` | `ai.chat` |
| Images | `?async=1` (Studio default) | `ai.image` |
| Audio | `x-async` / form `async` | `ai.audio` |
| IDE agent | `async` / `x-async` | `ai.ide` |

OpenAI-compatible **sync/stream** chat still works (same providers + tools layer) for clients that need SSE.

## Providers

```
modules/providers/
  provider.types.ts      # AiProvider, ProviderId
  base.provider.ts
  provider.registry.ts
  openai/openai.provider.ts
  anthropic/anthropic.provider.ts
  zg-router/zg-router.provider.ts   # default: OpenAI + Anthropic fallback
```

## Disable / override

- Set `TOOLS_ENABLED=false` or pass `"tools": null` on the completion body to skip the server tool loop.
- Insert a `ToolDef` row with `active=false` and matching `name` to disable a builtin.
- Active `ToolDef` rows can override description/parameters for builtins (same name).

## Streaming

Tool rounds run **non-streaming**. If the client sets `stream: true` and tools are enabled, the server still runs the tool loop and returns a **JSON** final completion (with `micropay_tools` metadata). Pure streaming without tools still proxies SSE from the provider.
