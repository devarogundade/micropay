# Micropay

Pay-per-use AI on Algorand (x402 / USDC).

## Packages

| Path | Domain | Purpose |
|------|--------|---------|
| `landing/` | `micropay.website` | Marketing hub (Vite SPA) |
| `app/` | `app.micropay.website` | **App product** — TanStack Start UI (frontend) |
| `code/` | `code.micropay.website` | **IDE product** — TanStack Start UI (frontend) |
| `backend/` | API host | **NestJS** — DB, x402, AI, BullMQ, S3, WebSocket, admin |
| `packages/site-meta` | — | Shared constants / challenge *approach* only |

**Server logic lives only in `backend/`.** `app` and `code` API routes are thin proxies to Nest (`VITE_PUBLIC_API_URL`). Product tables remain separate (`User`/`Activity`/… vs `CodeUser`/`CodeActivity`/…).

See [backend/README.md](./backend/README.md) and [backend/MIGRATION.md](./backend/MIGRATION.md).

Hackathon tracking: same approach (GoPlausible + `x402-global-challenge` + merchant cards).

See [DEPLOYMENT.md](./DEPLOYMENT.md).
