# Backend migration map — server logic moved from `app` / `code` → NestJS

## Status legend
- DONE: Nest path exists and is wired for production use
- PARTIAL: Works with noted gaps (usually missing external credentials/providers)
- TODO: Not started / intentionally deferred

## `code/` (IDE) → Nest

| Legacy path | Nest module | Status | Notes |
|-------------|-------------|--------|-------|
| `POST /api/v1/ide/agent` | `modules/ide` | DONE | x402 + PricingService + providers; optional async `ai.ide`; knowledge/tool injection; client IDE tools advertised |
| `GET /api/v1/templates` | `modules/ide` | DONE | Excludes archived |
| `GET /api/v1/templates/:id` | `modules/ide` | DONE | |
| `POST /api/v1/clone` | `modules/ide` | DONE | Real x402 settle; **per-template** price via `template:{slug}` (legacy `__template_clone__` fallback) or DEFAULT_AMOUNT |
| `GET /api/v1/models` | `modules/ai` | DONE | Router catalog + per-model `price_usdc` |
| `POST /api/v1/puya-ts/compile` | `modules/ide` | DONE | `@algorandfoundation/puya-ts` + structural fallback |
| `lib/x402-server.ts` | `modules/payments` | DONE | `@x402/core` + `@x402/avm` + GoPlausible facilitator |
| `lib/activities-store.ts` (Code*) | `modules/ide` | DONE | Activity + usage writes on agent |
| `lib/templates-store.ts` | `modules/ide` + admin | DONE | Admin upload/update/archive; **no seed data** |
| `lib/ide-knowledge.ts` | `modules/ai` KnowledgeDoc | PARTIAL | Injected when admin-created docs exist (no auto-seed) |
| `prisma/schema.prisma` Code* | `database/entities/code-*` | DONE | TypeORM entities |

## `app/` (product) → Nest

| Legacy path | Nest module | Status | Notes |
|-------------|-------------|--------|-------|
| `POST /api/v1/chat/completions` | `modules/chat` | DONE | x402 + providers (ZG) + stream; **selectable tools** (`tool_names` / `tools`); optional `async` → BullMQ `ai.chat` + WS |
| `GET/POST /api/v1/chat/sessions*` | `modules/chat` | DONE | |
| `POST /api/v1/images/generations` | `modules/images` | DONE | Sync + `?async=1` + BullMQ `ai.image` + WS `job.*` (no job SSE) |
| `GET /api/v1/images/history` | `modules/images` | DONE | `{ data: [] }` shape |
| `GET /api/v1/images/jobs/:id` | `modules/images` | DONE | Prefer WS `job.progress` / `job.completed` |
| `POST /api/v1/audio/transcriptions` | `modules/audio` | DONE | Multipart + history; optional async → `ai.audio` |
| `GET /api/v1/audio/history` | `modules/audio` | DONE | |
| `GET /api/v1/activities` | `modules/activities` | DONE | |
| `POST /api/v1/storage/upload` | `modules/storage` | DONE | S3 upload + presign |
| Prisma User/Activity/Chat/Image* | `database/entities/*` | DONE | TypeORM entities |

## Admin surfaces

| Path | Purpose |
|------|---------|
| `GET /api/v1/admin/pricing` | List rules (+ `?withModels=1`); returns `defaultAmount` |
| `GET/PUT/POST/DELETE /api/v1/admin/pricing/:modelId` | Per-model price CRUD (delete → DEFAULT_AMOUNT) |
| `GET/PUT/DELETE /api/v1/admin/pricing/templates/:slug` | Per-template clone price (`template:{slug}`) |
| `GET /api/v1/admin/pricing/templates` | List template pricing rules |
| `GET/POST/PATCH /api/v1/admin/templates*` | Template upload/update |
| `POST /api/v1/admin/templates/:id/archive\|unarchive` | Soft archive |
| `GET/POST/DELETE /api/v1/admin/settings*` | Settings CRUD (**no seed endpoints**) |

## Pricing model

1. Admin sets `PricingRule` keyed by `model:{modelId}` / `modelSlug` for inference.
2. Admin sets `PricingRule` keyed by `template:{slug}` for clone (product `code`).
3. `PricingService.resolveAmountForModel(modelId)` / `resolveAmountForTemplate(slug)` → active rule price, else `DEFAULT_AMOUNT` (env, default `0.1`; model prices are clamped to `0.1`-`0.5`, with image generation at `0.5` and audio transcription at `0.4`).
4. Legacy `__template_clone__` model rule is still honored as a fallback when no per-template rule exists.
5. All payment gates (chat, images, audio, IDE agent, clone) call resolve helpers.
6. Public template list includes resolved `priceUsdc`.

## PayTo

Single merchant: `X402_PAY_TO` (network via `NETWORK` / `X402_NETWORK`). Dual `X402_PAY_TO_APP` / `X402_PAY_TO_CODE` removed.

## New Nest-only surfaces

| Path | Purpose |
|------|---------|
| `GET /health` | Liveness + network |
| `GET /api/v1/usage` | Usage records |
| `POST /api/v1/ai/jobs` | Enqueue BullMQ AI jobs |
| `GET /api/v1/ai/knowledge` | Knowledge base |
| `GET /api/v1/ai/tools` | Tool defs |
| `WS /realtime` | `job.progress` + `job.completed` + `job.failed` + `usage.updated` |
| `GET /api/v1/payments/config` | Public x402 network/ASA |

## Providers + unified AI jobs

- Inference goes through `modules/providers` (`ProviderId`: `zg_router` | `openai` | `anthropic`).
- Flow: **x402 gate → settle → `AiJob` + BullMQ enqueue → worker → WS**.
- Queues: `ai.process`, `ai.embed`, `ai.image`, `ai.chat`, `ai.audio`, `ai.ide`.
- Chat keeps OpenAI-compat sync/SSE when `async` is not set.

## Frontend strip checklist

1. Set `VITE_PUBLIC_API_URL=http://localhost:4000` in `app` and `code`.
2. Prefer browser → Nest direct (`apiUrl()` / `VITE_PUBLIC_API_URL`); TanStack Start `/api/v1/*` routes are thin `proxyToNest` fallbacks only.
3. App chat sessions + activities call Nest REST (no Prisma createServerFn for those).
4. `app/src/lib/realtime.ts` uses `socket.io-client` against Nest `/realtime` (`waitForJob` for image/AI jobs).
5. Keep wallet UI, Monaco, localStorage IDE chat client-side.
6. Serve `.well-known/x402.json` from Nest static or keep on CDN with Nest URLs.

### Remaining / blocked

| Item | Reason |
|------|--------|
| Vector embeddings for KnowledgeDoc | No embedding provider env/API wired; worker stores metadata only |
| Optional Nest MCP adapter (`POST /mcp`) | Deferred product decision |
| Knowledge/ToolDef content | Admin must create rows — intentional (no seeds) |
| S3 for image persist | Requires AWS_* env; without it responses keep `b64_json` |
| Live x402 settle | Requires `X402_PAY_TO` + facilitator reachability |
| Models catalog createServerFn fallback | Soft Nest→local fallback remains for offline Nest; prefer Nest prices |
| Chat tools + SSE | Tool rounds are non-stream; see `docs/AI_TOOLS.md` |
| Image job SSE | Removed; Studio uses Socket.IO `waitForJob` |
| Audio async payload | Stores base64 in `AiJob.input` (bounded by upload limit) |
