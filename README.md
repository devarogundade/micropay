# Micropay

Pay-per-use AI on Algorand (x402 / USDC).

## Packages

| Path | Domain | Purpose |
|------|--------|---------|
| `landing/` | `micropay.website` | Marketing hub (Vite SPA) |
| `app/` | `app.micropay.website` | **App product** — TanStack Start, paid APIs, Prisma |
| `code/` | `code.micropay.website` | **IDE product** — Vite SPA (not an app clone; no Prisma/certs) |
| `packages/site-meta` | — | Shared constants / challenge *approach* only |

App and IDE are **separate products**. `code/` is a standalone Vite SPA that calls app APIs (`VITE_PUBLIC_API_URL`). Postgres / Prisma live in **`app/` only**; IDE spend is `Activity` with `type: "IDE"` written by those APIs.

Hackathon tracking: same approach (GoPlausible + `x402-global-challenge` + merchant cards) — **not** dual databases or cloning app's fullstack stack into `code/`.

See [DEPLOYMENT.md](./DEPLOYMENT.md).
