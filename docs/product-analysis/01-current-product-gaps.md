# 01 — Current Product Gap Analysis

> Basis: the full codebase audit in `docs/01–18` (2026-07-19). Committee lens: PM + architect + finance expert. Scoring: **Impact** (on the "Finance OS" goal), **Value** (to the current power user), **Cx** = complexity (S/M/L/XL), **LT** = long-term importance, **QW** = quick win (≤ a week, high payoff).

## What exists today (compressed inventory)

**Strong foundation**: 5-type unified transaction row with double-entry posting; derived balances with hard-reset; credit-card statements/utilization/pay-bill; investments-as-accounts with live prices (AMFI/Yahoo/CoinGecko/gold) + SIP schedules + goals; budgets (overall + category, 80% alerts); recurring engine with catch-up backfill; subscriptions with cost normalization; group splitting with paise-exact settlement optimization + link/QR multi-user sync; lend/borrow with repayments; spaces; calendar + 45-day upcoming feed; analytics/insights/monthly review; CSV/PDF export; quick-add NL parser; brand + institution registries (UPI-aware); data-less push reminders; JSON backup; 4 auth modes; offline app shell.

**The honest one-line assessment**: Ledger today is an excellent *manual* ledger with the best data model in its class — and zero ingestion, zero intelligence, and a sync layer that cannot yet be trusted across two devices.

## Gap classification

### A. Missing capabilities (don't exist at all)

| # | Gap | Impact | Value | Cx | LT | QW |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | **Any automated ingestion** (statement/CAS/payslip import, SMS/email/receipt capture) | ★★★★★ | ★★★★★ | L–XL | Critical — this is the entire gap between "tracker" and "OS" | — |
| A2 | **Review inbox** (drafts, dedup confirmations, alerts) — `app/inbox/` placeholder exists | ★★★★★ | ★★★★ | M | Critical (every automation lands here) | — |
| A3 | **Net-worth history** (never snapshotted; computed live only) | ★★★★ | ★★★★ | S | High | ✅ monthly snapshot file |
| A4 | **Loans/EMIs** (CC is the only liability; no principal/interest/amortization) | ★★★★ | ★★★★ | M | High | — |
| A5 | **Sell/realized P&L for investments** (units only accumulate) | ★★★★ | ★★★ | M | High (blocks tax + rebalancing) | — |
| A6 | **Tax layer** (no 80C/LTCG/TDS/regime concepts despite SIP tracking) | ★★★★ | ★★★★ | L | Critical for Indian power users | — |
| A7 | **Document vault** (attachments exist per-transaction; no standalone document store, no policy/statement filing) | ★★★★ | ★★★ | M | Critical (feeds automation + estate) | — |
| A8 | **Insurance tracking** (nothing) | ★★★ | ★★★ | S–M | High | — |
| A9 | **FI/retirement planning** (goals exist; no projection, SWR, corpus math) | ★★★★ | ★★★ | M | High | — |
| A10 | **Cash-flow forecasting** (upcoming feed exists but no projected-balance curve) | ★★★★ | ★★★★ | S–M | High | ✅ v1 from existing upcoming feed |
| A11 | **Scenario simulation** ("what if I retire at 45 / invest 50k/mo") | ★★★ | ★★★ | M–L | High | — |
| A12 | **Family/household** (single-user by construction; groups ≠ family) | ★★★★ | ★★ today | XL | Critical decade-scale | — |
| A13 | **Rules engine** (auto-categorize/tag/route by merchant/account/amount) | ★★★★ | ★★★★ | M | Critical (multiplies every import) | — |
| A14 | **Custom categories** (9 fixed enums; tags are the only escape) | ★★★ | ★★★★ | M (migration!) | Medium | — |
| A15 | **Credit score / bureau tracking** | ★★ | ★★ | S (manual entry) | Medium | — |
| A16 | **Public API / plugin surface** | ★★★ | ★★ | L | High (ecosystem play) | — |

### B. Weak features (exist but under-deliver)

| # | Weakness | Detail | Impact | Cx | QW |
| --- | --- | --- | --- | --- | --- |
| B1 | **Multi-device sync** | Whole-file LWW silently loses data; offline boot signs out; failed writes dropped | ★★★★★ (trust) | M–L | partial |
| B2 | **Shared groups** | Deletes resurrect, edits don't propagate, no rename/member-remove, no auth beyond UUID | ★★★★ | M | — |
| B3 | **CC statement cycle** | Lifetime-payment comparison → status sticks "Paid"; no cycle history | ★★★★ | M | — |
| B4 | **Search** | Category taps drop the filter; no tag search; 8-result cap; no deep links | ★★★ | S | ✅ |
| B5 | **Google sign-in** | Local mode in disguise; copy misleads | ★★★ (trust) | S (copy) | ✅ |
| B6 | **Reminders** | Due-date-only at 09:00 UTC; no lead time, no per-item control, UTC/IST off-by-one | ★★★ | S | ✅ |
| B7 | **Goals** | Flat target vs balance; no monthly-contribution math, no projection, buried in Investments | ★★★ | S–M | — |
| B8 | **Debit cards** | `debitCardId` never set → "today's spending" always ₹0; hover-only delete | ★★ | S | ✅ |
| B9 | **Currency** | Symbol-only, no ISO/FX; `Account.currency` decorative | ★★ (until NRI/crypto) | M | — |
| B10 | **Savings rate** | Budget-relative, not income-relative — misleading number | ★★★ | S | ✅ |
| B11 | **Backups** | Exclude attachment blobs → dangling metadata on restore | ★★★ | S–M | — |

### C. Incomplete workflows (dead ends found in the audit)

Transfer/cc_payment rows uneditable · group expenses not editable/back-datable · recurring un-pause backfills everything silently · subscription anchor drift · reconcile exists but no guided "match against statement" flow (reconciliation without a statement is guesswork) · monthly review is read-only (no "act on this" hooks) · sync-error badge not actionable.

### D. Missing intelligence & analytics

No anomaly detection, no MoM narrative explanation ("why is this month +23%?"), no merchant-level analytics page, no tag analytics, no time-series on Analytics (SpendBars exists, unused there), no year-in-review, no income analytics beyond totals, no category learning from user corrections (categorization is static keyword tables).

### E. Missing integrations (ranked by realism for this architecture)

1. **File imports** — bank CSV/PDF/XLSX, CAMS/KFintech MF CAS, NSDL/CDSL CAS, Zerodha/broker tradebooks, EPFO passbook (all client-side parseable; zero new trust required). 
2. **PWA share-target + clipboard** — SMS/UPI screenshots/text shared into the app.
3. **Email ingestion** — forwarding alias on a Cloudflare Email Worker (selective, privacy-preserving) vs full mailbox OAuth (rejected in [03-automation-strategy.md](03-automation-strategy.md)).
4. **Account Aggregator (India)** — the endgame for bank/MF auto-sync, but requires an FIU-registered TSP partner (Setu/Finvu) and a real backend + compliance posture; a Year-3+ decision, not a feature.
5. Calendar (ICS feed export — cheap), broker APIs (Kite Connect — paid, power-user BYO-key), price feeds (already done).

## Top-10 ranked gap list (single ordering, all factors weighed)

1. **A2 Review inbox** — the keystone; everything else lands in it.
2. **B1 Sync trust** — no OS can be built on a ledger that loses writes.
3. **A1a Statement/CSV/CAS import + A13 rules + dedup** — kills 80% of manual entry for a power user.
4. **A3 Net-worth snapshots + A10 cash-flow forecast** — cheap, transforms the dashboard from "tracker" to "dashboard of record".
5. **A1b Payslip/salary pipeline** — recurring high-value document, structured, feeds tax.
6. **A6 Tax layer v1** (capital-gains ledger + deduction tagging + document filing).
7. **A4 Loans/EMI + B3 statement cycles** — complete the liability story.
8. **A7 Document vault** — prerequisite for tax/insurance/estate; extends existing attachments.
9. **A5 Sell legs / realized P&L**.
10. **A9 FI planner v1** (deterministic projection on existing goals + snapshots).

Quick-win basket (do alongside anything): A3, B4, B5, B6, B8, B10, search deep-links, ICS calendar feed.
