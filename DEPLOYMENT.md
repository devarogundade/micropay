# Micropay subdomain deployment

## Topology

| Host | Folder | Role |
|------|--------|------|
| `micropay.website` | `landing/` | Marketing + **sole GoPlausible / Bazaar / hackathon entry** |
| `app.micropay.website` | `app/` | Models, chat/images/audio, paid APIs, MCP |
| `code.micropay.website` | `code/` | puya-ts IDE (SPA); paid agent/compile call app |

Shared identity: `@micropay/site-meta` (`packages/site-meta`).

## Single hackathon / GoPlausible entry (do not split)

1. Register **only** `https://micropay.website` with GoPlausible / Bazaar.
2. Keep **one** `X402_PAY_TO` on the app (all paid routes: chat, images, audio, ide agent).
3. Authoritative merchant card: `https://micropay.website/.well-known/x402.json`  
   Endpoint paths are **absolute** URLs on `app.micropay.website`.
4. Bazaar icon / OG scrape: apex landing assets (`/assets/brand/*`, `/og.png`).
5. Do **not** create separate merchant configs or challenge entries for `app.` or `code.`.

Leaderboard attribution follows `X402_PAY_TO` + challenge tag `x402-global-challenge`, not subdomain count.

## Netlify (recommended: 3 sites, 1 repo)

Create three Netlify sites from the same GitHub repo:

### 1) Landing (primary / merchant)

- Base directory: `landing`
- Build: `npm run build` → publish `dist`
- Domain: `micropay.website` (+ redirect `www` → apex)
- Env:
  - `VITE_PUBLIC_SITE_URL=https://micropay.website`
  - `VITE_PUBLIC_APP_URL=https://app.micropay.website`
  - `VITE_PUBLIC_CODE_URL=https://code.micropay.website`

### 2) App

- Base directory: `app`
- Build: existing TanStack Start / Vite build (`vite build`)
- Domain: `app.micropay.website`
- Env: full `.env.example` set, plus:
  - `PUBLIC_SITE_URL` / `VITE_PUBLIC_SITE_URL=https://micropay.website`
  - `PUBLIC_APP_URL` / `VITE_PUBLIC_APP_URL=https://app.micropay.website`
  - `VITE_PUBLIC_CODE_URL=https://code.micropay.website` (IDE nav + `/ide` redirect → code host)
  - `VITE_REDIRECT_APEX_LANDING=true` (after landing is live)
  - Same `X402_PAY_TO` as today
  - Optional: `CORS_ALLOWED_ORIGINS` extra origins (defaults include `https://code.micropay.website` and `http://localhost:5000`)

### 3) Code

- Base directory: `code`
- Build: `npm run build` → publish `dist`
- Domain: `code.micropay.website`
- Env:
  - `VITE_PUBLIC_SITE_URL=https://micropay.website`
  - `VITE_PUBLIC_APP_URL=https://app.micropay.website`

## DNS

At your DNS provider (or Netlify DNS):

- `micropay.website` → Netlify landing site
- `www.micropay.website` → redirect to apex
- `app.micropay.website` → Netlify app site
- `code.micropay.website` → Netlify code site

Use Netlify’s domain UI to attach custom domains (CNAME / ALIAS as prompted).

## Alternative: one Netlify site + subdomain proxies

Possible but messier (path routing / edge redirects between static landing and SSR app). Prefer three sites so TanStack Start SSR on `app` stays isolated and apex stays a thin static merchant entry.

## Local monorepo

```bash
# from repo root (after npm install at root or per package)
npm run dev:landing   # :4000
npm run dev:app       # :3000 (from app workspace / existing bun|npm)
npm run dev:code      # :5000
```

`app` historically uses Bun (`bun.lock`). Landing/code are plain Vite npm packages. You can keep installing `app` with Bun while using npm for landing/code until you unify the package manager.

## Remaining product work

1. DNS + three Netlify sites + env vars above
2. Confirm GoPlausible still points at apex only; refresh Bazaar scrape of `/.well-known/x402.json`
3. Optionally retire in-app landing once apex redirect is on

## Risks

- Registering app/code separately → duplicate challenge entries (avoid)
- Leaving `PUBLIC_APP_URL` as apex while hosting APIs only on app → wrong OG/canonical; set both `PUBLIC_SITE_URL` and `PUBLIC_APP_URL`
- `VITE_*` URLs are build-time for Vite SPAs — redeploy after changing them
