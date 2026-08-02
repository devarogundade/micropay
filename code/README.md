# Micropay Code

Client-only Vite + TanStack Router SPA for editing, compiling, deploying, and sharing Algorand TypeScript projects.

## Architecture

```text
browser IDE -> HTTPS -> NestJS backend -> PostgreSQL / Redis / AI / Puya / x402
```

Code does not own a database and contains no Prisma client, migrations, API proxy routes, server functions, provider credentials, payment settlement logic, or server compiler. Models, real Puya compilation, paid agents, templates, clone accounting, and persistence belong to `../backend`.

Browser-owned functionality includes Monaco, project state, local structural diagnostics, GitHub integration, wallet signing, and Algod deployment.

## Environment

Create `.env.local` from `.env.example`:

```dotenv
VITE_PUBLIC_API_URL=http://localhost:4000
VITE_X402_NETWORK=testnet
```

`VITE_PUBLIC_API_URL` is required and browser-visible. Configure backend CORS to allow the Code origin and expose x402 payment response headers.

## Development

```powershell
# Repository root
npm run dev:backend
npm run dev:code
```

Code runs at `http://localhost:5000` by default.

## Checks

```powershell
npm run generate-routes
npm run typecheck
npm run build
```

The production output is `dist`. Static hosting must rewrite application routes to `index.html`.

For Vercel, use Root Directory `code`, enable access to files outside the root
for `packages/site-meta`, and use the committed `vercel.json`.
