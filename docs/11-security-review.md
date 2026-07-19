# 11 — Security Review

Severity: **HIGH / MED / LOW**. Verified findings only; no XSS sinks (`dangerouslySetInnerHTML`/`eval`/`innerHTML`) exist anywhere, and secret-pattern greps across tracked files came back clean.

## Token & session

| Sev | Finding | Detail |
| --- | --- | --- |
| HIGH (blast radius) | **OAuth scope is `repo`** — full read/write to *all* the user's repositories, not just `ledger-data` (`lib/auth/github-oauth.ts:15`) | A leaked token compromises every private repo. A fine-grained PAT or GitHub App installation scoped to one repo would be least-privilege; the PAT path exists but nothing recommends limiting it. |
| MED | **Token in plain localStorage** (`ledger:session`, `lib/auth/session.ts:3,17`) | Any XSS = exfiltration. Mitigations: no injection sinks; only third-party script is Google GSI. Static-export constraint makes httpOnly cookies impossible; risk is inherent to the architecture. |
| MED | **Sign-out doesn't clean up** (`app-store.ts:440-451`) | Token not revoked; `ledger:data:*` localStorage and IndexedDB attachments survive — previous user's data readable by the next "local" sign-in on a shared machine. |
| LOW | No token expiry/refresh handling | Revoked token surfaces as load failure → forced sign-out. |

## OAuth flow

- ✅ CSRF `state` generated, sessionStorage-held, strictly validated; callback double-fire guarded.
- **MED — Worker token exchange is an open oracle**: committed default `ALLOWED_ORIGINS="*"` (`worker/wrangler.toml:8`) + no PKCE + caller-supplied `redirect_uri` means any origin can redeem authorization codes for this client ID. Bounded by GitHub's registered callback URL, but the shipped default should be the Pages origin, and PKCE would close code-interception.
- LOW — the catch-all POST routing means the exchange answers on any unmatched path.

## Worker abuse surface (all endpoints unauthenticated, no rate limiting)

| Sev | Endpoint | Risk |
| --- | --- | --- |
| MED | `/groups*` | UUID = read+write credential. Anyone with a join link can read all expenses, **wholesale-rewrite the group** (PUT replaces arrays), rename it, or stuff 256 KiB of arbitrary JSON per group; contents stored unvalidated (`unknown[]`) — client Zod on load is the only backstop. No delete endpoint, no TTL, no owner, no revocation. Unauthenticated create = KV stuffing. |
| LOW | `/push/subscribe` | Arbitrary URL registrable as a push endpoint → daily cron POSTs to it (blind request-forgery beacon) + unbounded `dates` array = KV stuffing. `/push/unsubscribe` lets anyone delete a known endpoint. 404/410 cleanup limits persistence. |
| LOW | `/prices` | Open fan-out proxy (per-symbol Yahoo fetches, attacker-controlled cache keys) — quota burn. Caching mitigates. |
| — | KV enumeration | No route lists keys; UUIDv4 not practically enumerable. ✅ |

## Secrets hygiene — ✅ clean

- `.env.local` never tracked (`git log --all` empty); contains only public-by-design `NEXT_PUBLIC_*` names.
- Worker secrets (client secret, VAPID keys) live in wrangler secrets; `wrangler.toml` holds only KV namespace IDs (not secret). `.dev.vars.example` placeholders only.
- OAuth client ID + worker URL hardcoded in `deploy.yml` — client IDs are public by design; LOW/accepted (though inconsistent with README's "set as secrets" advice).

## Data privacy

| Sev | Finding |
| --- | --- |
| ✅ | Backups contain only ledger data — no session, no tokens. |
| ✅ | Push is data-less: Worker stores only endpoint + bare dates; notification text composed on-device. |
| LOW/MED | **Icon-CDN telemetry**: rendering account/merchant icons fetches favicons from Clearbit, Google S2, favicone.com, and a hardcoded Wikipedia URL — third parties learn which banks and merchants the user uses, keyed by IP (`components/institution-icon.tsx`, `brand-icon.tsx`). Bundling icons locally would eliminate this. |
| INFO | Attachments (receipts) are plain files in the `ledger-data` repo; confidentiality rests entirely on repo privacy + the broad-scope token. |
| INFO | Shared-group data (names, amounts, descriptions) sits unencrypted in Cloudflare KV, readable by anyone holding the UUID. |

## Input validation

- Client: Zod on every storage read and backup import; sheets validate before submit.
- Worker: groups name capped/trimmed; expenses/settlements arrays unvalidated; push dates unvalidated. No HTML generation server-side; query params are `encodeURIComponent`-ed into upstream URLs — no injection path found.
- URL params (`?code=`, `?id=`, `?name=`) flow only through React text rendering (auto-escaped) or fetches.

## Client-side gating

`AuthGate` is purely client-side (inherent to static export) — it protects UX, not data; data protection is the GitHub token. Correct model, worth stating.

## Prioritized remediations

1. Set `ALLOWED_ORIGINS` to the Pages origin (config change, immediate).
2. Add PKCE to the OAuth flow (client + worker).
3. Move to fine-grained repo access: GitHub App or documented fine-grained-PAT guidance; stop requesting `repo`.
4. Groups hardening: per-group write token issued at create (share read-only vs read-write links), Zod-validate payload shape server-side, add DELETE + TTL, per-IP rate limits (Cloudflare WAF rules would do).
5. Purge local data + revoke token on sign-out.
6. Bundle institution/brand icons locally.
