# Ledger

A personal-finance OS in your pocket — budgets, expenses, accounts, credit cards, investments, bill splitting, and **automated statement import**. Mobile-first, dark, and fast. Deploys to GitHub Pages with **GitHub itself as the database**.

Aesthetic: black background, subtle borders, large typography, bottom-sheet interactions inspired by the ChatGPT iOS app, Linear, and Raycast.

## Automation (the point)

Manual entry is the fallback, not the workflow:

- **Statement import** — upload bank/credit-card **CSV or PDF** statements. Columns are auto-mapped from known headers (editable), Indian narrations are decoded (UPI/NEFT/IMPS/NACH/ATM/POS/interest/salary/refunds), and every row lands as a draft in the **Inbox**. Duplicate detection scores amount/date/merchant similarity: certain matches merge silently into your manual entries, uncertain ones ask, and re-importing the same statement is a no-op (per-line hashes).
- **Credit-card aware** — importing into a card treats credits as payments/refunds (never income) and recognizes the bank-side leg of a card bill payment by card name.
- **Capture anywhere** — share a payment SMS/UPI message to Ledger from the phone share sheet (PWA share target), or paste it at `/capture`. Amount, direction, date, VPA, and account are parsed into an Inbox draft.
- **Rules engine** — "anything containing BLINKIT is Food": rules auto-categorize, rename, and tag every import and quick-add. Recategorize a known merchant once and Ledger offers to create the rule for you.
- **Recurring detection** — repeating merchants are mined from history and suggested as subscriptions, bills, or EMIs with one-tap tracking.
- **Cash-flow forecast** — every schedule (recurring, subscriptions, SIPs, card dues) projects your liquid balance 90 days out; the dashboard warns before you go negative.
- **Net-worth history** — monthly snapshots captured automatically; trend chart on Accounts.
- **Tax pack** — one CSV per financial year (Apr–Mar) with income, investment transactions, deduction-tagged expenses (#80c #80d #hra), and category totals.

## Everything else

- **Quick add** — `lunch 450`, `uber 280 @hdfc yesterday`, `chai 30 #office`; parsed with category inference, account hints, dates, and tags.
- **Expenses** — full history with search, time filters (incl. FY presets), category/account/space/tag filters, sorting, infinite scroll, attachments, per-field edit history.
- **Accounts** — cash/bank/wallet/credit cards/investments; derived balances, statements & utilization, pay-bill flow, reconciliation, hard reset, debit cards.
- **Investments** — holdings with live prices (AMFI mutual funds, stocks, crypto, gold/silver), SIP schedules, goals.
- **Budgets** — overall + per-category with near-limit and over-budget alerts.
- **Bill splitting** — groups with equal/unequal/percentage splits (paise-exact), minimum-transaction settlement, and shared groups via link/QR with background sync.
- **Lend & borrow** — per-person IOUs with repayments and net positions.
- **Spaces** — trip/project budgets. **Calendar** — heatmap + upcoming bills. **Analytics, monthly reviews, CSV/PDF reports.**
- **PWA** — offline shell, installable, privacy-preserving bill reminders (data-less push: the server only ever knows dates).
- **Trustworthy by design** — offline never signs you out, failed writes retry, files that fail validation become read-only instead of being overwritten, and every imported row keeps provenance back to its statement line.

## Tech

Next.js 15 (static export) · TypeScript (strict) · Tailwind CSS v4 · shadcn-style Radix primitives · Zustand · Zod · Recharts · pdf.js · Sonner · Vaul · Octokit · jsPDF · Vitest (75 tests).

## Architecture

Strict separation of concerns:

```
lib/
├── domain/        Pure business logic — no React, no IO
│   ├── types.ts        Zod schemas + inferred types (single source of truth)
│   ├── ingest/         Statement pipeline: csv, pdf, narration decoder,
│   │                   dedup scoring, rules, recurrence mining, SMS capture
│   ├── balances.ts     Derived balances, credit-card & net-worth math
│   ├── forecast.ts     90-day liquid-balance projection
│   ├── snapshots.ts    Monthly net-worth history
│   ├── settlement.ts   Group balances + min-transaction settlement
│   ├── recurring.ts / subscriptions.ts / recurring-investments.ts
│   ├── tax.ts          FY tax-pack shaping
│   └── …analytics, insights, review, reports, quick-add, budget, calendar
├── storage/       Swappable adapters (localStorage / GitHub via Octokit),
│                  validation + migrations, invalid-file protection
├── store/         Zustand store — the only bridge between UI and domain/storage
├── auth/ · export/ · groups/ · pwa/ · brands/ · institutions/ · pdf/
```

UI lives in `components/` (primitives in `ui/`, bottom sheets in `sheets/`, screens in `views/`). Business logic never lives in components.

Data is structured JSON in a private `ledger-data` repo (GitHub mode) or localStorage (device mode): `expenses, accounts, recurring, subscriptions, groups, budgets, settings, spaces, lendBorrows, recurringInvestments, goals, inbox, rules, snapshots` + `attachments/*`.

## Setup

```bash
npm install
npm run dev          # http://localhost:3000
```

Sign in with **Continue on this device** for a zero-config local trial.

### Environment variables (all optional)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | GitHub OAuth app client id |
| `NEXT_PUBLIC_GITHUB_TOKEN_EXCHANGE_URL` | Worker that exchanges the OAuth `code` (also the default base URL for prices/push/groups) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google sign-in (identity only — data stays on-device) |
| `NEXT_PUBLIC_BASE_PATH` | Base path when hosted under a sub-path (e.g. `/ledger`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Enables push bill reminders |
| `NEXT_PUBLIC_PRICES_URL` / `NEXT_PUBLIC_PUSH_URL` / `NEXT_PUBLIC_GROUPS_URL` | Override individual worker endpoints |

## Scripts

```bash
npm run dev        # dev server
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # static export to out/ (build dir .next-build)
```

CI runs typecheck, lint, and tests before every deploy.

## Backend (Cloudflare Worker)

A minimal worker in [`worker/`](worker/README.md) handles GitHub OAuth token exchange, market prices (AMFI/Yahoo/CoinGecko/gold), data-less push reminders, and shared-group sync (KV). Everything else is fully static — without the worker the app still works via personal-access-token or on-device mode.

## Deploy to GitHub Pages

```bash
NEXT_PUBLIC_BASE_PATH=/<repo> npm run build
```

Push to `main` — the included Action typechecks, lints, tests, builds, and publishes `out/`.
