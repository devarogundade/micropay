# Micropay NestJS Backend

Single server for **app** (chat/images/audio) and **code** (IDE) products.

## Stack

- NestJS 11 + TypeORM + PostgreSQL
- BullMQ (Redis) for AI jobs: `ai.process`, `ai.embed`, `ai.image`
- Socket.IO WebSocket at `/realtime` (`job.progress`, `usage.updated`)
- AWS S3 storage (+ optional legacy Supabase env)
- Dual network: `NETWORK=testnet|mainnet` (also drives x402 + 0G defaults)
- Admin API for settings + pricing (`x-admin-api-key`)

See [MIGRATION.md](./MIGRATION.md) for what moved from `app/` / `code/`.

## Local run

### Prerequisites

1. PostgreSQL (e.g. `localhost:5432/micropay`)
2. Redis (e.g. `localhost:6379`)
3. Node 22.11+ / pnpm

### Setup

```powershell
cd backend
pnpm install
copy .env.testnet.example .env.testnet.local
# edit DATABASE_URL, ZG_ROUTER_API_KEY, X402_PAY_TO, ADMIN_API_KEY, AWS_*
$env:NETWORK="testnet"
pnpm run start:dev
```

Backend listens on **http://localhost:4000** by default.

## Docker

From the repository root:

```powershell
Copy-Item backend/.env.docker.example backend/.env.docker
docker compose --env-file backend/.env.docker up --build -d
Invoke-RestMethod http://localhost:4000/health
```

The Compose stack includes PostgreSQL, Redis, and the API/worker process. See
`../DEPLOYMENT.md` for production migration and Vercel frontend guidance.

Apply committed schema changes to an existing database before deployment:

```powershell
pnpm run migration:run
```

### Frontends

```powershell
# in app/.env.local and code/.env.local:
VITE_PUBLIC_API_URL=http://localhost:4000
NEST_API_URL=http://localhost:4000
```

Then `npm run dev:app` / `npm run dev:code` from the monorepo root.

### Useful endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Liveness + network |
| GET | `/api/v1/models` | 0G catalog |
| GET | `/api/v1/templates` | IDE templates |
| POST | `/api/v1/ide/agent` | IDE agent (x402) |
| POST | `/api/v1/clone` | Template clone (x402) |
| POST | `/api/v1/storage/upload` | S3 upload |
| GET/POST | `/api/v1/admin/*` | Settings + pricing |
| WS | `/realtime` | Job + usage events |

Admin requests need header: `x-admin-api-key: $ADMIN_API_KEY`.

## Env profiles

- `.env.example` — full reference
- `.env.testnet.example` → `.env.testnet.local`
- `.env.mainnet.example` → `.env.mainnet.local`

`NETWORK` selects which file is preferred via `ConfigModule.envFilePath`.
