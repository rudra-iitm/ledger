# Ledger Worker

A small Cloudflare Worker backing the static Ledger frontend (GitHub Pages). It does three jobs:

1. **GitHub OAuth token exchange** — keeps the client secret off the browser.
2. **Investment price quotes** — fetches & caches MF NAV, crypto, metals and stock prices.
3. **Due-bill reminders** — stores push subscriptions and sends a daily Web Push for bills/card dues.

## Endpoints

`POST /` with JSON `{ "code": "<oauth code>", "redirect_uri": "<same redirect used to authorize>" }`
→ `{ "access_token": "gho_..." }`

`GET /health` → `{ "ok": true }`

`GET /prices?mf=120503&crypto=bitcoin&metal=gold,silver&stock=RELIANCE.NS`
→ `{ "prices": { "mf:120503": 84.2, "crypto:bitcoin": 5400000, "metal:gold": 7100, "stock:RELIANCE.NS": 1430 }, "asOf": "..." }`
Sources: AMFI (mutual funds, by scheme code), CoinGecko (crypto, by id), goldprice.org (metals, per gram INR), Yahoo Finance (stocks/ETFs, best-effort). Responses cached ~10 min.

`POST /push/subscribe` with `{ subscription, dates: ["YYYY-MM-DD", ...] }` — stores the browser's push subscription and the dates it should be pinged.
`POST /push/unsubscribe` with `{ endpoint }` — removes it.

The cron trigger (daily, 09:00 UTC) sends a data-less push to any subscription with a due date that day. The service worker on the device reads its locally-cached upcoming events and shows the notification — **no financial data is ever stored on the worker**, only opaque subscriptions + dates.

CORS is handled for the origins listed in `ALLOWED_ORIGINS`.

## Setup

```bash
cd worker
npm install
```

Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps):
- **Authorization callback URL**: `https://<your-site-origin>/auth/callback/`
- Copy the **Client ID** and generate a **Client secret**.

### Local dev

```bash
cp .dev.vars.example .dev.vars   # fill in the two values
npm run dev                      # http://localhost:8787
```

### Reminders setup (one time)

```bash
# 1. Create the KV namespace and paste its id into wrangler.toml ([[kv_namespaces]] id).
npx wrangler kv namespace create PUSH

# 2. Generate a VAPID keypair (any machine; needs the web-push CLI once).
npx web-push generate-vapid-keys
#   -> Public Key  : set as BOTH the worker secret VAPID_PUBLIC_KEY and the
#                    site env NEXT_PUBLIC_VAPID_PUBLIC_KEY
#   -> Private Key : set as the worker secret VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT     # mailto:you@example.com
```

If KV/VAPID are not configured, OAuth and prices still work; only reminders are disabled (the Settings toggle hides itself when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is unset).

### Deploy

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
# lock CORS to your site (recommended)
npx wrangler deploy --var ALLOWED_ORIGINS:https://<your-site-origin>
```

`wrangler deploy` prints the worker URL, e.g. `https://ledger-auth.<account>.workers.dev`.

## Wire it to the frontend

Set these env vars for the Next.js build (e.g. in CI / GitHub Actions secrets):

```
NEXT_PUBLIC_GITHUB_CLIENT_ID=<oauth app client id>
NEXT_PUBLIC_GITHUB_TOKEN_EXCHANGE_URL=https://ledger-auth.<account>.workers.dev
# optional — reminders; same value as the worker's VAPID_PUBLIC_KEY secret
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid public key>
```

`/prices` and `/push/*` are served from the same worker origin, so the frontend derives them from
`NEXT_PUBLIC_GITHUB_TOKEN_EXCHANGE_URL` automatically (override with `NEXT_PUBLIC_PRICES_URL` /
`NEXT_PUBLIC_PUSH_URL` if you host them elsewhere).

With both set, the "Continue with GitHub" button runs the full OAuth redirect flow and exchanges the code through this worker. Without them, the app falls back to the personal-access-token sheet and on-device mode.
