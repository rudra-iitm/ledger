# 14 — Technical Debt Register (Prioritized)

Ordered by (user impact × likelihood). Effort: S < 1 day, M = days, L = week+.

## P0 — Data-safety correctness

| # | Debt | Where | Effort | Why now |
| --- | --- | --- | --- | --- |
| 1 | **Offline/failed boot signs the user out** — any `loadAll` error clears the session | `app-store.ts:424-431` | S–M | Defeats the PWA; distinguish 401 from network error, add offline state + cached snapshot |
| 2 | **Zod-invalid file → silent empty fallback → next write persists the wipe** | `repository.ts:77-87` | S | Surface an error and go read-only for that file instead of substituting defaults |
| 3 | **Failed persists silently dropped**; later success on another file masks the error | `app-store.ts:249-252` | M | Outbox queue + retry + actionable error UI |
| 4 | **Cross-device LWW clobbers** — conflict = refetch SHA + overwrite | `github.ts:76-83` | M–L | At minimum detect-and-warn; ideally 3-way merge or per-entity granularity |
| 5 | **Zero tests** on money/settlement/balances/migrations (README claims Vitest) | — | M | The invariants in [08-business-logic.md](08-business-logic.md) §"Invariants" are one regression away from silent money errors |

## P1 — Feature correctness

| # | Debt | Where | Effort |
| --- | --- | --- | --- |
| 6 | **CC statement status uses lifetime payments** (no statement-period windowing; no `statementDate` field) — status sticks at "Paid" after the first cycle | `balances.ts:105-127` | M |
| 7 | **Shared-group deletions resurrect; edits never propagate** (union-by-id, no tombstones, local-wins) | `sync.ts:115-133`, `app-store.ts:784-789` | M |
| 8 | Worker PUT `/groups/:id` skips the rev check when `expectedRev` isn't a number | `worker/src/groups.ts:153` | S |
| 9 | Subscription renewal anchor drifts permanently after short months (Jan 31 → forever 28th) | `subscriptions.ts:6-20` | S |
| 10 | Un-pausing recurring items backfills **all** missed occurrences (probably surprising) | `recurring.ts:64-127` | S |
| 11 | `ensureRepo` caches a rejected promise → adapter bricked for the session | `github.ts:27` | S |
| 12 | Google sign-in is local mode in disguise (login copy promises GitHub-backed storage) | `google-oauth.ts`, `app-store.ts:222-234` | S (copy) / L (real sync) |

## P2 — Security posture (full list in [11-security-review.md](11-security-review.md))

13. `ALLOWED_ORIGINS="*"` shipped default (S). 14. No PKCE (M). 15. `repo` scope over-grant (M–L). 16. Sign-out doesn't purge local data or revoke token (S). 17. Groups: no write auth / no delete / unvalidated payloads / no rate limits (M).

## P3 — Product debt (UX gaps, from [10-ui-inventory.md](10-ui-inventory.md))

18. Group rename/member-remove/expense-edit unreachable. 19. Transfer & cc_payment rows uneditable. 20. Search category results drop the filter; tag search missing. 21. Debit-card `debitCardId` never set (spending always ₹0) + hover-only delete. 22. Calendar week pager missing. 23. Sync-error badge not actionable. 24. Backups exclude attachment blobs (restore leaves dangling metadata).

## P4 — Hygiene

25. Remove 7 unused deps; fix stale README. 26. Extract shared recurrence engine + `useSheetForm` (~600 duplicated lines). 27. Split `app-store.ts` into slices or CRUD factory. 28. Add CI gates (typecheck, lint, tests) + worker deploy job. 29. Dynamic-import Octokit. 30. SW cache version bump per deploy. 31. Delete stray files (`ib.png`, template SVGs); decide fate of empty `app/inbox/` + `components/receipt/`. 32. Document all 8 env vars in `.env.example`. 33. Shared app↔worker contract types. 34. `downloadCsv` URL revoke; multi-dot amount inputs; `DATA_REPO` single source.

## Suggested first sprint

Items **1, 2, 3, 8, 11, 13, 16** are each ≤1 day and remove the worst data-loss and security edges; item **5** (test the four core domain modules) locks the foundation before any refactors (26, 27) touch it.
