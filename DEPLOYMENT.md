# Micropay subdomain deployment

## Topology

| Host | Folder | Role |
|------|--------|------|
| `micropay.website` | `landing/` | Marketing hub (Vite SPA) |
| `app.micropay.website` | `app/` | **App product** — TanStack Start, app Prisma, paid AI APIs, MCP |
| `code.micropay.website` | `code/` | **IDE product** — TanStack Start, code Prisma, agent/templates |

Shared package: `@micropay/site-meta` — **constants / challenge approach only** (facilitator URL, challenge tag, merchant card builders). No shared runtime API or shared DB models.

**Database:** App and code may use the **same `DATABASE_URL`** (one Postgres), but **completely separate** Prisma schemas, migrations, and tables:

| Product | Schema / migrations | Tables |
|---------|---------------------|--------|
| App | `app/prisma` | `User`, `Activity`, `Chat*`, `Image*`, `Transcription`, `UserModelUsage` |
| Code | `code/prisma` → Postgres schema `code` (`db push`) | `CodeUser`, `CodeActivity`, `CodeUserModelUsage`, `CodeTemplate`, `CodeTemplateClone` |

Zero shared table names, rows, or Prisma models. App uses Prisma Migrate on `public`; code applies its schema with `db push` scoped to Postgres schema `code` (so app tables are never touched).

Migrate / push:

```bash
cd app && npm run db:migrate   # app tables
cd code && npm run db:push     # code tables
```


## Hackathon tracking (same *approach*, dual merchant entries)

| Product | Merchant card | Paid routes | PayTo / DB |
|---------|---------------|-------------|------------|
| App | `https://app.micropay.website/.well-known/x402.json` | chat, images, audio | App `X402_PAY_TO` + app tables |
| IDE | `https://code.micropay.website/.well-known/x402.json` | agent, template clone | Code `X402_PAY_TO` + code tables |

1. GoPlausible facilitator (`https://facilitator.goplausible.xyz`)
2. Challenge tag `x402-global-challenge`
3. Product merchant cards for discovery
4. Separate activity tables — app `Activity` vs code `CodeActivity`

## Netlify (3 sites, 1 repo)

### 1) Landing

- Base directory: `landing`
- Build: `npm run build` → publish `dist`
- Domain: `micropay.website` (+ `www` → apex)
- Env: `VITE_PUBLIC_SITE_URL`, `VITE_PUBLIC_APP_URL`, `VITE_PUBLIC_CODE_URL`

### 2) App

- Base directory: `app`
- Domain: `app.micropay.website`
- Env: full `app/.env.example` (`DATABASE_URL`, `X402_PAY_TO`, `ZG_ROUTER_*`, SSL certs under `app/certs` if needed)
- Owns Prisma: `app/prisma` (+ `npm run db:migrate`)

### 3) Code (IDE)

- Base directory: `code`
- Domain: `code.micropay.website`
- Env: full `code/.env.example` (`DATABASE_URL`, `X402_PAY_TO`, `ZG_ROUTER_*`, certs under `code/certs` if needed)
- Owns Prisma: `code/prisma` (+ `npm run db:push`)

## DNS

- `micropay.website` → landing
- `www.micropay.website` → redirect to apex
- `app.micropay.website` → app
- `code.micropay.website` → code

## Local monorepo

```bash
npm run dev:landing   # :4000
npm run dev:app       # :3000
npm run dev:code      # :5000
```

Migrate each product’s tables (same URL OK):

```bash
cd app && npm run db:migrate
cd code && npm run db:push
```
