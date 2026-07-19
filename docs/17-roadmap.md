# 17 — Roadmap (Recommended Sequencing)

Derived from the debt register ([14](14-technical-debt.md)), missing features ([15](15-missing-features.md)), and inferred vision ([16](16-product-vision.md)). Phases are ordered so each unlocks the next; risks listed inline.

## Phase 0 — Stop the bleeding (days)

1. Fix offline boot sign-out (distinguish 401 vs network; offline state).
2. Replace silent-empty-fallback on Zod failure with surfaced error + read-only file.
3. Outbox: queue + retry failed persists; actionable sync-error badge.
4. Worker config: `ALLOWED_ORIGINS` → Pages origin; fix the `expectedRev` type-check skip; reset `ensureRepo` on rejection.
5. Sign-out hygiene: purge `ledger:data:*` + IndexedDB, revoke token.
6. Honest copy: label Google sign-in as on-device; fix README claims.

**Risk if skipped**: every later phase builds features on a foundation that can silently lose the user's money data.

## Phase 1 — Foundation hardening (1–2 weeks)

7. Vitest + tests for money/settlement/balances/migrations/materializers (the [08](08-business-logic.md) invariants).
8. CI gates: typecheck + lint + test on PR; worker deploy job.
9. Extract shared recurrence engine + `useSheetForm`; remove 7 unused deps; dynamic-import Octokit.
10. Shared `contract.ts` types for app↔worker payloads.
11. SW cache versioning per deploy.

## Phase 2 — Sync you can trust (2–4 weeks)

12. Multi-device safety: base-content 3-way merge on 409 (or per-year expense files to shrink blast radius) + "remote changed" detection on focus.
13. Shared groups v2: tombstoned deletes, `updatedAt` per item for edit propagation, per-group write token + read-only share links, group delete + KV TTL, server-side payload validation, rate limits.
14. PKCE + fine-grained repo access (GitHub App or documented fine-grained PAT).

**This phase is the prerequisite for advertising multi-device or multi-user use at all.**

## Phase 3 — Capture automation (the visible product bet)

15. Inbox screen (`app/inbox/` placeholder): due bills, near-limit budgets, pending review items.
16. Paste-SMS / share-target import → parsed transaction drafts in the inbox (quick-add parser + brand registry already do the hard part).
17. Receipt capture (`components/receipt/` placeholder): attach → (later) OCR draft.
18. Debit-card picker in expense sheet (activates the dormant `debitCardId` machinery).

## Phase 4 — Finance depth

19. Statement-cycle modeling (`statementDate`, per-cycle payment windows) — fixes the stuck-"Paid" defect and enables statement history.
20. Sell legs for investments (negative units, realized P/L).
21. Loan/EMI account type reusing the liability flip + Upcoming feed.
22. Net-worth monthly snapshots + trend chart; cash-flow forecast from the upcoming feed.
23. Reminder lead times ("3 days before").

## Phase 5 — Polish backlog (parallel, low-risk)

Group rename/member management/expense edit + back-dating; transfer/cc_payment editing; search deep-links with applied filters + tag search; calendar week pager; analytics time-series; attachment blobs in backups; custom categories or promoted tags; bundled institution icons (kills the privacy leak too).

## Explicit non-goals

Bank aggregation, real-time collaboration, server-side expansion beyond the Worker's four jobs — see [16-product-vision.md](16-product-vision.md).

## Risks register

| Risk | Mitigation |
| --- | --- |
| Refactors (engines, store) before tests exist | Phase 1 orders tests first |
| GitHub API quota/behavior changes | Write amplification work (Phase 2) reduces exposure; adapter interface allows a backend swap |
| Worker abuse (open endpoints) | Phase 0/2 hardening; Cloudflare WAF rate rules |
| Single maintainer bus-factor | This docs set + Phase 1 CI is the mitigation |
