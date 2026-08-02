# Landing — micropay.website

Apex marketing + **authoritative GoPlausible / Bazaar merchant entry**.

## Role

- Hosts `/.well-known/x402.json` with absolute endpoint URLs on `app.micropay.website`
- OG / canonical meta for domain scrape (single hackathon entry)
- Links to `app.` and `code.` product surfaces
- Hero: animated MicroPay SVG wordmark + nested glow arcs (ported from the former in-app landing)

Do **not** register `app.micropay.website` or `code.micropay.website` as separate GoPlausible merchants.

## Dev

```bash
npm install
npm run dev
```

Env (optional):

```
VITE_PUBLIC_SITE_URL=https://micropay.website
VITE_PUBLIC_APP_URL=https://app.micropay.website
VITE_PUBLIC_CODE_URL=https://code.micropay.website
```

## Vercel

- Create a Vercel project with Root Directory `landing`.
- Enable access to source files outside the Root Directory for `packages/site-meta`.
- Build command: `npm run build`; output directory: `dist`.
- Attach `micropay.website` and `www.micropay.website`.
- `vercel.json` handles the `www` redirect, SPA fallback, and merchant-card headers.
- See root `DEPLOYMENT.md`
