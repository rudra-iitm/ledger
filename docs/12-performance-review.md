# 12 — Performance Review

Personal-scale app; nothing is urgent today, but several costs grow with data volume or deploy count.

## What's already good ✅

- Recharts is behind `next/dynamic` at both usage sites; jsPDF + autotable are `await import()` — the two heaviest visualization/export deps stay out of the initial bundle.
- Expenses list renders incrementally (25/page, IntersectionObserver sentinel) instead of mounting the full history.
- `recomputeBalances` preserves object identity for unchanged accounts (avoids spurious re-renders).
- Worker prices are double-cached (response cache ~10 min + upstream `cf.cacheTtl`).
- Static export + hashed assets + stale-while-revalidate SW = fast repeat loads.

## Findings (ranked)

| Sev | Finding | Detail / fix |
| --- | --- | --- |
| MED | **Octokit in the main bundle for everyone** | `lib/storage/github.ts` is statically imported by the store, so local-mode users pay for the full `octokit` meta-package. Dynamic-import it inside `buildAdapters`. |
| MED | **GitHub write amplification grows with history** | Every mutation re-serializes and commits the *whole* JSON file; expense add = 2 commits; materialization up to 4; backup import = 11. `expenses.json` grows unboundedly (plus 30-entry `history` per edited expense), so every add uploads an ever-larger base64 payload and burns API quota. Fixes: debounce/coalesce writes, split expenses by year (`expenses-2026.json`), or cap/trim history. |
| MED | **SW shell cache grows forever** | `VERSION = "ledger-v1"` is never bumped; stale-while-revalidate caches every content-hashed chunk from every deploy into `ledger-v1-shell`, and cleanup only triggers on a version change. Fix: bump version per deploy (build-time inject) or LRU-prune the cache. |
| LOW | **Attachment memory** | Base64 via string concatenation ≈ 1.33× inflation in memory; no storage-layer size cap (UI: 50 MB); GitHub >1 MB read quirk handled on read only. |
| LOW | **Derived state recomputed per render** | Balances/breakdowns/upcoming are recomputed in components from full arrays. Fine at personal scale (O(accounts×expenses) per mutation); memoize selectors if lists reach tens of thousands. |
| LOW | **Icon CDN requests at render time** | Favicon fetch chains (favicone → Google S2; Clearbit → Google) per distinct brand/institution; browser cache mitigates. Local bundling fixes both this and the privacy leak. |
| LOW | **11 parallel reads on boot** (GitHub mode) | Fine normally; no backoff if rate-limited. A single combined snapshot file would cut boot round-trips. |
| — | No virtualization | Infinite scroll makes it unnecessary until page counts get very large; revisit only if needed. |

## Non-findings

No N+1 queries (no query layer), no memory leaks found (one unrevoked object URL in `downloadCsv` is trivial), no repeated-API-call loops (group polling is intentional at 15s and scoped to the open detail view).
