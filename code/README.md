# Code — code.micropay.website

TanStack Start fullstack IDE (Algorand TypeScript / puya-ts), **app-style**:
Vite + `@tanstack/react-start` + Netlify plugin, Prisma, `/certs`.

## Architecture

| Concern | Where |
|---------|--------|
| IDE UI / wallet / Monaco / templates | `code/` (this package) |
| Paid IDE agent, compile, models, clone | **This host** — `/api/v1/ide/agent`, `/api/v1/puya-ts/compile`, `/api/v1/models`, `/api/v1/templates`, `/api/v1/clone` |
| Postgres / Prisma | **This package** — `code/prisma` only, Postgres schema `code`. Same `DATABASE_URL` as app is OK; **zero shared tables/models**. Apply with `npm run db:push` |
| IDE spend tracking | `CodeActivity` / `CodeUser` / `CodeUserModelUsage` |
| Template clone tracking | `CodeTemplate` / `CodeTemplateClone` |
| Merchant discovery | `public/.well-known/x402.json` |

App and IDE are separate products (own Netlify site / merchant card / Prisma schema).

## Env

See `.env.example`. Requires `DATABASE_URL`, `ZG_ROUTER_*`, `X402_*`.

## Dev

```bash
npm install   # repo root
npm run db:generate --workspace=code
npm run db:push --workspace=code
npm run dev:code
# → http://localhost:5000
```

## Netlify

- Base directory: `code`
- Build: `vite build` → `dist/client`
- Domain: `code.micropay.website`
- Set `DATABASE_URL` (may match app’s Postgres URL; tables remain separate)
- Apply code schema on setup (`npm run db:push`)
