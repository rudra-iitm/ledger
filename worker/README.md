# Ledger Auth Worker

A tiny Cloudflare Worker that performs the GitHub OAuth **token exchange** server-side, so the GitHub client secret never ships to the browser. The static Ledger frontend (GitHub Pages) calls this worker from the `/auth/callback` step.

## Endpoint

`POST /` with JSON `{ "code": "<oauth code>", "redirect_uri": "<same redirect used to authorize>" }`
→ `{ "access_token": "gho_..." }`

`GET /health` → `{ "ok": true }`

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
```

With both set, the "Continue with GitHub" button runs the full OAuth redirect flow and exchanges the code through this worker. Without them, the app falls back to the personal-access-token sheet and on-device mode.
