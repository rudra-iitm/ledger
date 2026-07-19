# 09 — State Management, Persistence & Sync

## The single store (`lib/store/app-store.ts`, 1,304 lines)

One un-sliced Zustand store is the only bridge between UI and domain/storage. State: `status` (`booting|unauthenticated|loading|ready`), `session`, `data: LedgerData` (all 11 collections), `syncStatus` (`synced|saving|error`). ~50 actions grouped by feature (lifecycle, expenses/income, attachments, budgets, recurring, groups incl. share/sync/join, accounts incl. debit cards/reconcile/adjust, spaces, subscriptions, tags/settings, transfers/CC payments, investments/SIPs, lend-borrow, goals, prices, backup).

No derived state lives in the store — balances, reports, upcoming feeds are computed in components via pure `lib/domain` functions on each render.

### Mutation pipeline

```
UI action
  → mutate(file, updater)            // one collection
    or mutateLedger(patch)           // expenses+accounts, then recomputeBalances
  → set({data})                      // synchronous optimistic update
  → persist(file, snapshot)          // enqueue write
```

`persist` (app-store.ts:236-255): per-file promise chains in a module-level `pendingWrites` map serialize writes to the same file, each committing its own snapshot in order (final state wins). `syncStatus`: `saving` on enqueue → `synced` when the map empties → `error` on failure.

### Persistence weaknesses (high-impact)

1. **Failed writes are dropped** — the catch sets `syncStatus:"error"` and discards the payload; no retry, no queue, no toast. Memory now diverges from storage; closing the tab loses the mutation. A later successful write to a *different* file resets the indicator to `synced`, masking the earlier loss.
2. **No debounce** — every action writes immediately; an expense add = 2 GitHub commits (expenses + accounts).
3. **Sign-out during in-flight writes** — clears the map but in-flight promises keep the old token in closure and can still commit after sign-out.

## Hydration (`initialize` → `loadData`)

Called once from `providers.tsx`. Session from localStorage → build adapters — **GitHub adapter iff `session.githubToken` exists; Google and local sessions both get LocalStorageAdapter** — → `loadAll` (11 parallel reads) → materialize recurring/subscriptions/SIPs into concrete expenses → `recomputeBalances` → `ready` → persist changed files → fire-and-forget `refreshPrices`.

**Any load error signs the user out and clears the session** (app-store.ts:424-431). This conflates "revoked token" with "network down": opening the PWA offline (GitHub mode) logs you out, since data reads are cross-origin and not service-worker cached.

## Storage adapters

- **Adapter contract**: `readFile/writeFile` per named `DataFile` (11 names).
- **LocalStorageAdapter**: `ledger:data:<file>` keys; no quota handling (~5 MB cap surfaces as `syncStatus:"error"`).
- **GitHubStorageAdapter**: private `ledger-data` repo (auto-created); `data/<file>.json`, one commit per write; per-file SHA cache; on 409/422/404 → refresh SHA + retry once — **last-writer-wins, remote changes are clobbered, never merged**. No rate-limit handling or backoff. `ensureRepo` memoizes its promise — a transient failure caches the rejection and **bricks the adapter for the session**.
- **Repository layer**: parse → migrate → Zod validate; **on validation failure silently returns empty defaults** — combined with per-action persistence this can wipe a file's real contents on the next write (the top data-safety hazard; recoverable only via git history). Corrupt JSON (parse throw) bubbles to `initialize` → sign-out.

## Multi-device semantics (GitHub mode)

- **Write races**: Device A and B both hold `expenses.json`; A commits; B's stale SHA → 422 → refresh → **B overwrites, silently deleting A's expense**. No merge, no warning.
- **No re-pull**: a device never sees another device's changes until a full app reload.
- **Verdict**: GitHub mode is safe for one device at a time; concurrent multi-device use will eventually lose data.

## Shared-group sync (`lib/groups/sync.ts` + Worker)

- Optimistic concurrency via integer `rev`; on 409 the server returns its copy, the client merges and retries once.
- **Merge = union-by-id, local wins on collision** (`mergeSharedIntoLocal`). Consequences: **deletions resurrect** (no tombstones — a deleted expense is re-unioned from any peer and pushed back), and **edits to existing items never propagate** (no timestamp comparison).
- **Polling, not push**: 15s interval + window-focus, only while the group detail view is open; otherwise sync happens only on mutation.
- Errors are dropped — offline group mutations are never queued.

## Offline support summary

| Layer | Offline behavior |
| --- | --- |
| App shell | ✅ SW: navigations network-first w/ cache fallback; assets stale-while-revalidate |
| Data, local mode | ✅ fully offline (localStorage + IndexedDB) |
| Data, GitHub mode | ❌ no cache, no queue; boot offline = signed out; mutations while offline are lost on reload |
| Group sync | ❌ best-effort only |
| Reminders | ✅ event details cached locally; push is just a data-less ping |

There are no optimistic-rollback semantics (writes are assumed to succeed), no background sync, and no `navigator.onLine` handling anywhere.

## Caching

- Prices: Worker-side (Cache API ~10 min + upstream TTLs); client stores `currentPrice`/`priceUpdatedAt` on accounts; refreshed on boot and manual button.
- Icons: browser HTTP cache of third-party favicon CDNs (no local fallback caching beyond in-memory error states).
- SW caches: `ledger-v1-shell` (app assets, grows across deploys — see [12-performance-review.md](12-performance-review.md)), `ledger-v1-reminders` (upcoming-events JSON for the push handler).

## Recommendations (ranked)

1. Distinguish auth failure (401) from network failure in `initialize`; keep the session and enter an offline/retry state, ideally with a last-known-good snapshot cached locally.
2. Queue-and-retry failed persists (IndexedDB outbox); make the error badge actionable.
3. Reduce LWW blast radius: three-way merge using the base SHA's content, or per-entity files, or at minimum a "remote changed, reload?" prompt on 409.
4. Add tombstones (`deletedAt`) to shared-group items so deletions propagate.
5. Reset the memoized `ensureRepo` promise on rejection.
