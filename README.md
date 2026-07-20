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
- **Anomaly alerts** — the Inbox warns about likely double charges, subscription price hikes, and categories running far above their 3-month average; every alert shows its evidence and is dismissable.
- **Financial health score** — six explainable components (savings rate, emergency fund, debt load, diversification, budget discipline, cash cushion) with the formula printed under each — no black boxes.
- **Smart search** — "food last month" or "amazon this year" compiles into applied filters on the expense list.
- **Budget suggestions** — one tap fills budgets from your last three months' per-category medians.
- **An agent, not a chatbot** — there is no AI screen, no "Ask AI" button and nothing to prompt. A background runtime watches your ledger and publishes **signals**: ranked, dismissable statements that appear when they're true and vanish when they aren't ("Short before payday", "Spotify looks recurring", "3 sorted for you"). Every signal shows its numbers on tap.

  The intelligence is two layers, and the order matters. The **computed layer** is pure, offline and free — cash-flow overdrafts, budget breaches, double charges, price hikes, renewals, untracked subscriptions. It needs no API key and carries the app on its own. The **model layer** (bring-your-own Gemini key) is an enhancement on top: it categorises imported rows the rules couldn't place, writes the rule when it has seen a merchant twice, and refreshes a one-line daily brief. Pull the key out and Ledger still tells you the balance goes negative on the 14th — it just says it in our words instead of the model's.

  Autonomous work is capped at **6 model calls a day**, runs serially on idle, backs off exponentially on failure, and fails **silently** — you didn't ask for it, so you don't get an error about it. Settings lists every job the agent may run, what it has spent today, and a single switch to stop it. The key lives in your browser only (never synced, never in backups) and prompts are data-minimised. Also: **document scanning** (photograph a receipt or pick a PDF invoice/payslip/statement) and **insights** with evidence and confidence levels. See [docs/19-ai-architecture.md](docs/19-ai-architecture.md).
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

Next.js 15 (static export) · TypeScript (strict) · Tailwind CSS v4 · shadcn-style Radix primitives · Zustand · Zod · Recharts · pdf.js · Sonner · Vaul · Octokit · jsPDF · Vitest (193 tests).

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
├── ai/            Provider-agnostic AI layer (see docs/19-ai-architecture.md)
│   ├── provider.ts     The contract — swap Gemini without touching a feature
│   ├── models.ts       Capability tiers as model fallback chains
│   ├── client.ts       The one door: cache, spend guards, retry, validation
│   ├── gemini.ts       Transport only, w/ model + request-body degradation
│   ├── tools.ts        Read-only tools bridging the model to lib/domain
│   ├── prompts/        Versioned templates; data-minimisation lives here
│   ├── features/       advisor · documents · categorize
│   └── agent/          The background runtime — see below
│       ├── types.ts       Signal model + deterministic ranking
│       ├── signals.ts     Computed signals: pure, offline, free, no key
│       ├── jobs.ts        Autonomous work; each fingerprints its own inputs
│       ├── runtime.ts     Scheduler: daily ceiling, backoff, idle dispatch
│       ├── run-ledger.ts  Device-local run bookkeeping (never synced)
│       └── dismissals.ts  Device-local signal dismissals
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
npm run build      # static export to out/
```

CI runs typecheck, lint, and tests before every deploy.

## Backend (Cloudflare Worker)

A minimal worker in [`worker/`](worker/README.md) handles GitHub OAuth token exchange, market prices (AMFI/Yahoo/CoinGecko/gold), data-less push reminders, and shared-group sync (KV). Everything else is fully static — without the worker the app still works via personal-access-token or on-device mode.

## Deploy to GitHub Pages

```bash
NEXT_PUBLIC_BASE_PATH=/<repo> npm run build
```

Push to `main` — the included Action typechecks, lints, tests, builds, and publishes `out/`.
