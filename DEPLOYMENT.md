# Micropay Deployment

## Topology

| Host | Folder | Role |
|------|--------|------|
| `micropay.website` | `landing/` | Marketing Vite SPA |
| `app.micropay.website` | `app/` | Client-only product SPA |
| `code.micropay.website` | `code/` | Client-only IDE SPA |
| `api.micropay.website` | `backend/` | NestJS API, PostgreSQL, Redis, AI, Puya, S3, x402, Socket.IO |

Runtime flow:

```text
app/code browser -> https://api.micropay.website -> backend services
```

Only `backend` receives `DATABASE_URL`, provider credentials, payment recipient settings, storage credentials, Redis configuration, and admin keys. Frontend deployments receive browser-visible `VITE_*` variables only.

## Vercel Frontends

Create three Vercel projects from this repository. Use Node.js 22.x and enable
"Include source files outside the Root Directory" because each project imports
`packages/site-meta`.

| Project | Root Directory | Build | Output | Domain |
|---------|----------------|-------|--------|--------|
| Landing | `landing` | `npm run build` | `dist` | `micropay.website`, `www.micropay.website` |
| App | `app` | `npm run build` | `dist` | `app.micropay.website` |
| Code | `code` | `npm run build` | `dist` | `code.micropay.website` |

Each project has a committed `vercel.json` for SPA rewrites and merchant-card
headers. Landing also redirects `www` to the apex domain.

Required frontend environment:

```dotenv
VITE_PUBLIC_API_URL=https://api.micropay.website
VITE_X402_NETWORK=mainnet
```

Set the public app/site/code origins documented in each package's `.env.example`.

## Docker Backend

Copy the container environment template and fill its required values:

```powershell
Copy-Item backend/.env.docker.example backend/.env.docker
docker compose --env-file backend/.env.docker up --build -d
docker compose ps
Invoke-RestMethod http://localhost:4000/health
```

This starts PostgreSQL 16, Redis 7, and the Nest API/workers. Data is persisted
in named Docker volumes. Local Compose defaults to `DATABASE_SYNC=true` so a
fresh development database can be bootstrapped.

Stop the stack without deleting data:

```powershell
docker compose --env-file backend/.env.docker down
```

Delete local database and queue data only when explicitly needed:

```powershell
docker compose --env-file backend/.env.docker down --volumes
```

### Production Containers

Build the runtime image with:

```powershell
docker build --target runtime -t micropay-backend ./backend
```

Production must set `DATABASE_SYNC=false`, `DATABASE_SSL` according to the
database provider, and run committed migrations before the API rollout:

```powershell
docker compose --env-file backend/.env.docker --profile migration run --rm migrate
```

The current migration history is incremental and does not yet contain a full
baseline for every table. Do not use the migration profile against a blank
production database until a baseline migration is committed. The local Compose
schema-sync default is development-only.

Configure production variables from `backend/.env.example`, then run migrations before starting the API:

```powershell
cd backend
pnpm run migration:run
pnpm run build
pnpm run start:prod
```

Set these origin variables so HTTP and Socket.IO CORS allow the static sites:

```dotenv
PUBLIC_APP_URL=https://app.micropay.website
PUBLIC_CODE_URL=https://code.micropay.website
PUBLIC_SITE_URL=https://micropay.website
CORS_ALLOWED_ORIGINS=https://app.micropay.website,https://code.micropay.website
WS_CORS_ORIGIN=https://app.micropay.website,https://code.micropay.website
```

## DNS

- `micropay.website` points to the landing deployment.
- `app.micropay.website` points to the App static deployment.
- `code.micropay.website` points to the Code static deployment.
- `api.micropay.website` points to the Nest backend.

## Local Development

```powershell
npm run dev:backend  # :4000
npm run dev:app      # :3000
npm run dev:code     # :5000
```
