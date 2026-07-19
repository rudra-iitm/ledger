# 07 — API Reference

Two external APIs are in play: the project's own **Cloudflare Worker** (`worker/`, deployed as `ledger-auth`) and the **GitHub REST API** consumed via Octokit. There is no Next.js API layer (static export).

## Cloudflare Worker

Router: flat if-chain in `worker/src/index.ts:79-171`. Global behavior:

- **CORS**: `ALLOWED_ORIGINS` defaults to `"*"` (also the committed value in `wrangler.toml:8`); the response echoes the request Origin. Methods `GET, POST, PUT, OPTIONS`; `OPTIONS` always 204.
- **Authentication: none on any route. Rate limiting: none.**
- **Routing quirk**: any POST to an *unmatched* path falls through to the OAuth token exchange — `POST /anything` behaves like `POST /`.
- All responses JSON.

| Method | Path | Purpose | Handler |
| --- | --- | --- | --- |
| OPTIONS | `*` | CORS preflight | index.ts:88-90 |
| GET | `/health` | `{ok:true}` (no frontend caller) | index.ts:93-95 |
| GET | `/prices` | market-price proxy | index.ts:50-77 + prices.ts |
| POST | `/push/subscribe` | store subscription + due dates | push.ts:37-57 |
| POST | `/push/unsubscribe` | delete subscription by endpoint | push.ts:59-70 |
| POST | `/groups` | create shared group | groups.ts:103-134 |
| GET | `/groups/:id` | read full group | groups.ts:89-93 |
| PUT | `/groups/:id` | replace group (optimistic rev) | groups.ts:136-175 |
| POST | `/groups/:id/join` | append member (idempotent by id) | groups.ts:177-206 |
| POST | `/` (+ any unmatched POST) | GitHub OAuth code→token | index.ts:116-170 |
| cron | `0 9 * * *` UTC | daily due-date push | index.ts:173-179 → push.ts:136-164 |

### OAuth token exchange — `POST /`

Request `{code, redirect_uri?}` → Worker POSTs `https://github.com/login/oauth/access_token` with `client_id` + `client_secret` (the secret is the Worker's raison d'être) → response `{access_token}` only. Errors: 500 unconfigured, 400 bad JSON/missing code/GitHub rejection (with `error_description`), 502 GitHub HTTP failure. **No PKCE, no server-side state validation** (state is checked client-side, `lib/auth/github-oauth.ts:28-30`); `redirect_uri` is caller-supplied. Client: `lib/auth/github-oauth.ts:32-36`, scope `repo`.

### Prices — `GET /prices`

Query: `?mf=<AMFI codes>&crypto=<coingecko ids>&metal=gold,silver&stock=<yahoo tickers>&vs=<ccy, default inr>` (comma-separated). Response `{prices: {"<kind>:<id>": number}, asOf}`. The frontend never sends `vs`.

| Kind | Upstream | Cache |
| --- | --- | --- |
| mf | `amfiindia.com/spages/NAVAll.txt` (whole file, parsed by scheme code) | `cf.cacheTtl` 3600 |
| crypto | CoinGecko `/simple/price` | 600 |
| metal | `data-asg.goldprice.org/dbXRates/INR` (INR hardcoded; ounce→gram ÷31.1034768) | 600 |
| stock | Yahoo `query1.finance.yahoo.com/v8/finance/chart/<sym>` — **one fetch per symbol**, spoofed UA | 600 |

Plus a response-level Cloudflare Cache API layer keyed on the raw query string (`max-age=600`). All upstream failures are swallowed (best-effort partial results).

### Push — `POST /push/subscribe` / `POST /push/unsubscribe` + cron

- Subscribe body `{subscription: {endpoint, keys?}, dates?: string[]}` → KV `PUSH["sub:<endpoint>"] = {subscription, dates, updatedAt}`. Dates array is replaced wholesale on every sync; **no format/count/size validation**.
- Unsubscribe body `{endpoint}` → KV delete.
- Cron: list `sub:*`; for each, if UTC-today ∈ dates → send **data-less** Web Push (headers only, `TTL: 86400`; hand-rolled VAPID ES256 via WebCrypto, no libraries); 404/410 → delete sub; prune past dates. Note the UTC/local mismatch: the Worker compares UTC-today, the device SW filters by local-today — an off-by-one window for IST users, self-limited because the SW re-checks.

### Groups — `/groups*`

KV `GROUPS["group:<uuid>"] = {id, name, members[], expenses: unknown[], settlements: unknown[], rev, updatedAt}`. Expense/settlement contents are stored **unvalidated** (typed only client-side).

- **Create**: `{name ≤120 chars, members ≥1, expenses?, settlements?}` → server-minted `crypto.randomUUID()`, `rev:1`. Payload cap 256 KiB (413 above).
- **Read**: full group to anyone with the UUID.
- **Update**: `{expectedRev?, group}` — if `expectedRev` is a number and ≠ current rev → **409 with the current group in the body** (client merges + retries once). **If `expectedRev` is absent/non-numeric the check is silently skipped** → unconditional last-write-wins (groups.ts:153). Empty member list falls back to current members.
- **Join**: `{member: {id, name}}`, idempotent, bumps rev only when new.
- **No DELETE route exists** — shared groups live in KV forever (no TTL).

**Security model**: the UUID is simultaneously join code, read credential, and write credential. No owner, no per-member auth, no revocation. See [11-security-review.md](11-security-review.md).

### Worker environment

| Binding | Type | Purpose |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | secrets | OAuth exchange |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | secrets | Web Push signing |
| `ALLOWED_ORIGINS` | var (default `"*"`) | CORS |
| `PUSH` / `GROUPS` | KV namespaces | subscriptions / shared groups |

All optional in code — unbound features return 500/503 and the app self-disables them.

### Caller ↔ endpoint matrix

Every frontend caller maps to an implemented route and vice versa, with two server-only extras (`GET /health`, `vs=` param). Callers: token exchange ← `lib/auth/github-oauth.ts:32`; `/prices` ← `lib/store/app-store.ts:1272`; push ← `lib/pwa/reminders.ts:91,108,128`; groups ← `lib/groups/sync.ts:55,69,86,106`.

## GitHub REST API usage (Octokit)

| Operation | Call | Where |
| --- | --- | --- |
| Identify user | `users.getAuthenticated` | adapter init + login validation |
| Ensure data repo | `repos.get` → `repos.createForAuthenticatedUser` (private, auto_init) | `lib/storage/github.ts:27-42` |
| Read data file | `repos.getContent(data/<file>.json)` (11 parallel on load) | github.ts |
| Write data file | `repos.createOrUpdateFileContents` with cached SHA; on 409/422/404 → refresh SHA + retry once (**overwrites remote — LWW**) | github.ts:64-99 |
| Attachments | `createOrUpdateFileContents` / `getContent` (+ `git.getBlob` fallback >1 MB) / `deleteFile` | github-attachments.ts |

No rate-limit handling, no backoff, no batching (one commit per file write; an expense add = 2 commits: expenses + accounts). OAuth scope requested is `repo` (all repositories) — far broader than the single data repo needs.

## Third-party browser-side requests

- Google GIS script (`accounts.google.com/gsi/client`) for Google sign-in.
- Icon CDNs at render time: favicone.com, Google S2 favicons, Clearbit logo API, one hardcoded Wikipedia PNG — a passive privacy leak of which banks/merchants the user has (see [11-security-review.md](11-security-review.md)).
