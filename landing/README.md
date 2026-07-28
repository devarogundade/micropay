# Landing — micropay.website

Apex marketing + **authoritative GoPlausible / Bazaar merchant entry**.

## Role

- Hosts `/.well-known/x402.json` with absolute endpoint URLs on `app.micropay.website`
- OG / canonical meta for domain scrape (single hackathon entry)
- Links to `app.` and `code.` product surfaces

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

## Netlify

- Site base directory: `landing`
- Custom domain: `micropay.website` (+ `www` → apex)
- See root `DEPLOYMENT.md`
