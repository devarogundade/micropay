# Micropay App

Client-only Vite + TanStack Router SPA for chat, image generation, audio transcription, activity history, and the browser IDE.

## Architecture

```text
browser app -> HTTPS / Socket.IO -> NestJS backend -> PostgreSQL / Redis / AI / S3 / x402
```

The app does not own a database and contains no Prisma client, migrations, API proxy routes, server functions, provider credentials, payment settlement logic, or storage credentials. All business and persistence logic belongs to `../backend`.

## Environment

Create `.env.local` from `.env.example` and set:

```dotenv
VITE_PUBLIC_API_URL=http://localhost:4000
VITE_X402_NETWORK=testnet
```

`VITE_PUBLIC_API_URL` is required. Because it is a browser-visible variable, it must never contain credentials. Configure the backend CORS and Socket.IO origin allowlists for the app origin.

## Development

Run the backend first, then the app:

```powershell
# Repository root
npm run dev:backend
npm run dev:app
```

The app is available at `http://localhost:3000` by default.

## Checks

```powershell
npm run generate-routes
npm run typecheck
npm run build
```

The production output is a static SPA. Configure the host to rewrite application paths to `index.html`.

For Vercel, use Root Directory `app`, enable access to files outside the root
for `packages/site-meta`, and use the committed `vercel.json`.
