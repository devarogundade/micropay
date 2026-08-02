# Micropay

Pay-per-use AI on Algorand (x402 / USDC).

## Packages

| Path | Domain | Purpose |
|------|--------|---------|
| `landing/` | `micropay.website` | Marketing hub (Vite SPA) |
| `app/` | `app.micropay.website` | **App product** — client-only Vite + TanStack Router SPA |
| `code/` | `code.micropay.website` | **IDE product** — client-only Vite + TanStack Router SPA |
| `backend/` | API host | **NestJS** — DB, x402, AI, BullMQ, S3, WebSocket, admin |
| `packages/site-meta` | — | Shared constants / challenge *approach* only |

**Server logic lives only in `backend/`.** `app` and `code` call Nest directly from the browser through `VITE_PUBLIC_API_URL`; neither frontend contains API routes, server functions, database clients, migrations, or secrets.

See [backend/README.md](./backend/README.md) and [backend/MIGRATION.md](./backend/MIGRATION.md).

Hackathon tracking: same approach (GoPlausible + `x402-global-challenge` + merchant cards).

See [DEPLOYMENT.md](./DEPLOYMENT.md).
