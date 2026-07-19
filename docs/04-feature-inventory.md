# 04 — Feature Inventory

Every user-facing feature, verified from code (not routing alone). Status legend: ✅ complete · 🟡 partial · 🧩 hidden/unfinished.

## Core money tracking

### Expenses ✅
- **Purpose**: record spending with amount, category (9), date, account, space, tags, notes, attachments.
- **Entry points**: tab-bar `+` → ActionSheet → ExpenseSheet; quick-add input; calendar day sheet; space detail; edit via row tap or swipe.
- **Files**: `components/sheets/expense-sheet.tsx`, `components/views/expenses-view.tsx`, `components/expense-row.tsx`, `lib/domain/{types,transactions,analytics}.ts`.
- **Business logic**: `type:"expense"` is the only type counted as "spending" everywhere (`isSpend`). Edits append a per-field `history` audit trail (30-entry cap, `app-store.ts:524`).
- **Limitations**: amount input accepts multiple dots; attachments capped at 50 MB in UI but no storage-layer cap.

### Income ✅
- Separate sheet, stored as `Expense` with `type:"income"`, `category:"Other"`, `incomeCategory` (9 income categories) + `source`. Posts +amount to `accountId`.
- **Files**: `components/sheets/income-sheet.tsx`, `lib/domain/analytics.ts` (income mirror-set: totals, by-category, income-vs-expense).

### Transfers ✅ / 🟡
- Account→account, one row double-entry (`-` source, `+` destination). `affectsBalance` toggle.
- **Limitation**: transfer rows are **not editable after creation** — `ExpenseRow` only opens edit sheets for expense/income/investment types; tapping a transfer does nothing (delete-only via swipe).

### Quick add ✅
- `lunch 450`, `#food chai 30`, `rs. 1,200 groceries` → parsed amount + description + inferred category (first-keyword-wins over ~70 India-centric keywords). Always dated today, no account attached.
- **Files**: `components/quick-add-input.tsx`, `lib/domain/quick-add.ts`.

## Accounts & cards

### Accounts ✅
- Types: cash, bank, credit_card, debit_card, wallet, investment, other. Soft-delete via `archived`. Bank metadata (holder, masked account number, IFSC, branch, variant, minimum balance). Institution branding via `lib/institutions/registry.ts`.
- Balance card with **Include/Exclude Debt** toggle + stacked allocation bar.
- **Files**: `components/views/{accounts-view,account-detail-view}.tsx`, `components/sheets/account-sheet.tsx`, `components/account-card.tsx`, `lib/domain/{balances,accounts}.ts`.

### Credit cards ✅ / 🟡
- Positive balance = amount owed (liability sign flip). Statement balance/due-date/minimum-due fields, utilization bar, Paid/Partially Paid/Unpaid status, Pay-bill flow (quick-fill chips), payment history, due-date events in Upcoming feed.
- **Known defect**: statement status compares the current statement against **lifetime** `cc_payment` totals — no statement-period windowing, so after the first cycle status tends to stick at "Paid" (`lib/domain/balances.ts:105-127`). See [14-technical-debt.md](14-technical-debt.md).

### Debit cards 🟡
- Card records (network/expiry/last4) on bank accounts with card-visual UI.
- **Broken bits**: delete button is `opacity-0 group-hover:` (invisible on touch); per-card "today's spending" filters `expense.debitCardId` but **no sheet ever sets `debitCardId`** — always ₹0; references `/noise.png` which doesn't exist.

### Reconcile & balance adjust ✅
- ReconcileSheet: actual vs app balance, difference, optional posted adjustment (hidden for CC); history kept per account (`reconciliations[]`).
- AdjustBalanceSheet: set new balance, "Reset to ₹0", **hard reset** switch (rewrites `openingBalance`/`openingDate` so prior history is excluded from balance; forced for CC/investment).

## Investments

### Portfolio & holdings ✅
- Holding = investment-type Account with `assetType` (gold, silver, mutual_fund, etf, stock, sip, crypto, other). `units` summed from investment rows; `invested` = account balance; value = units × currentPrice; P/L derived.
- **Limitations**: no lot tracking; units never decrease (selling isn't modeled at unit level); units rounded to 2dp (lossy for MF units).

### Live prices ✅
- `refreshPrices` → Worker `/prices` (AMFI codes, Yahoo tickers, CoinGecko ids, gold/silver) → diffs into `currentPrice`. Requires the Worker.

### Recurring investments (SIP) ✅
- Own engine with quarterly support; materializes `type:"investment"` rows (respecting per-schedule `affectsBalance` for externally-funded SIPs).

### Goals ✅ / 🟡
- Target amount + tracked accounts; progress = Σ (holding value or balance) / target. Only surfaced on the Investments page.

## Planning & recurring

### Budgets ✅ — overall monthly + per-category; near-limit alert at 80%, over-budget flag; dashboard alerts.
### Recurring expenses/income/transfers/CC-bills ✅ — day-of-month anchored, catch-up backfill on materialization, pause/resume. Schema fields `weekday`/`monthOfYear` exist but are **never read** by the engine (weekly = startDate+7n, yearly = anniversary).
### Subscriptions ✅ — separate model with billing-cycle cost normalization (monthly/annual), renewing-soon alerts, brand icons, pause. **Quirk**: renewal anchor drifts permanently after short months (unlike recurring, which keeps its anchor).
### Calendar & upcoming ✅ — month heatmap/week/day views; upcoming feed (45-day horizon) merges recurring, subscriptions, SIPs, CC due dates. **Gap**: week view has no pager.

## Sharing & people

### Groups / bill splitting ✅ / 🟡
- Groups with members; equal/unequal/percentage splits (integer-paise exact); balances + minimum-transaction settlement (exact-match pass, then greedy two-pointer); record settlements.
- **Gaps**: groups can never be renamed (`openGroup(group?)` edit path exists in sheet-context but `GroupSheet` ignores it); members can't be removed; group expenses can't be edited (delete + re-add); split expenses can't be back-dated (`date: todayISO()` hardcoded).

### Shared groups (multi-user sync) ✅ / 🟡
- Share → Worker `POST /groups` → invite link/QR (`/groups/join?code=<uuid>`); join with display name; 15s polling + focus sync; optimistic `rev` with 409-merge-retry.
- **Weaknesses**: capability-URL-only security (UUID = read+write credential); **deletions resurrect** (union-by-id merge has no tombstones); edits to existing items never propagate (local copy wins); no group delete endpoint on the Worker.

### Lend & Borrow ✅ / 🟡
- Lent/borrowed entries per person, repayments (with settle-full shortcut), overdue status via dueDate, per-person net position page, attachments.
- **Pattern break**: uses full pages + native `confirm()` instead of sheets; entries not editable after creation; source account is "tracking only" (no ledger transaction).

### Spaces ✅ — trip/project buckets with own lifetime budget; tag expenses via `spaceId`; overview/expenses/files tabs; archive.

## Analysis & output

### Analytics ✅ — time-range presets + account filter; income vs expense; category donut + legend; by-account breakdown; brand-aware search (searching "swiggy" matches "Bundl Technologies"). No time-series chart on this page (SpendBars only lives in Space detail).
### Insights ✅ — top category, MoM trend, largest transaction, average daily (elapsed-day basis) / weekly spend.
### Monthly Review ✅ — month pager: stat tiles, highlights (most expensive day, most-used category/account), category changes vs previous month, top spaces, subscription totals, account insights. Savings rate is **budget-relative** (`(budget−spent)/budget`), not income-relative.
### Reports ✅ — CSV (proper quoting) + PDF (jsPDF, lazy-loaded) for any range; budget-performance section.
### Global search 🟡 — expenses (8 max, tap→edit), categories, groups. **Gaps**: category tap navigates to `/expenses` without applying the filter; tags advertised in placeholder but have no result section; no "see all" carrying the query.

## Platform

### Auth ✅ / 🟡 — GitHub OAuth (Worker exchange, `repo` scope), GitHub PAT, Google (GIS), local. **Google is identity-only**: no token kept → LocalStorageAdapter → data never leaves the device, despite login-screen copy implying GitHub-backed storage.
### Backup / restore ✅ — versioned JSON export (no tokens included); import = **full replace** with `window.confirm`; per-section Zod validation with specific errors. Attachment blobs are **not** included in backups.
### Push reminders ✅ — data-less Web Push: Worker stores subscription + bare dates; daily 09:00 UTC cron pings; SW composes notification locally from cached events; click opens `/calendar`.
### PWA / offline 🟡 — installable, offline app shell. But **GitHub-mode data is not cached**: offline boot signs the user out; failed writes are dropped. Local mode is fully offline.
### Settings ✅ — profile (provider-aware), budgets, currency symbol (₹/$/€/£ — display-only), tags manager, reminders toggle, backup/import, sign out.
### Sync indicator 🟡 — header dot (saving pulse / error icon); error state is not actionable (no retry/details).

## Hidden / planned 🧩

- `app/inbox/` and `components/receipt/` — empty untracked directories: an Inbox screen and receipt(-scanning?) components are evidently planned.
- `Expense.debitCardId` — schema + spending calc exist, no UI sets it.
- `RecurringExpense.weekday`/`monthOfYear`, `RecurringInvestment.weekday` — schema-only.
- `AccountSelect.includeInvestment` — prop never used.
- Worker `GET /health`, `/prices?vs=` — implemented server-side, never called by the app.
