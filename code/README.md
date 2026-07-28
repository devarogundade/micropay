# Code — code.micropay.website

Vite + React SPA hosting the Micropay Algorand TypeScript (puya-ts) IDE.

## Architecture

- **UI / wallet / Monaco** run here (`code/`)
- **Paid IDE agent** and **compile** stay on app:
  - `POST ${VITE_PUBLIC_APP_URL}/api/v1/ide/agent` (x402 USDC, same `X402_PAY_TO`)
  - `POST ${VITE_PUBLIC_APP_URL}/api/v1/puya-ts/compile` (free)
  - `GET ${VITE_PUBLIC_APP_URL}/api/v1/models` (catalog)
- Do **not** register a separate GoPlausible merchant for this host

## Env

See `.env.example`:

| Variable | Purpose |
|----------|---------|
| `VITE_PUBLIC_SITE_URL` | Landing / merchant link |
| `VITE_PUBLIC_APP_URL` | App API + App nav link |
| `VITE_X402_NETWORK` | Optional `testnet` (default mainnet) |

## Dev

```bash
# from repo root
npm install
npm run dev:code
# → http://localhost:5000
```

Point `VITE_PUBLIC_APP_URL` at a running app (`http://localhost:3000`) for local compile/agent.

## Netlify

- Base directory: `code`
- Build: `npm run build` → `dist`
- Domain: `code.micropay.website`
- See root `DEPLOYMENT.md`
