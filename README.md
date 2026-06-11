# Ledger

A minimal, premium personal-finance app — budgets, expenses, recurring bills, analytics, and bill splitting. Mobile-first, dark, and fast. Designed to deploy on GitHub Pages with **GitHub itself as the database**.

Aesthetic: black background, subtle borders, large typography, bottom-sheet interactions inspired by the ChatGPT iOS app, Linear, and Raycast.

## Features

- **Quick Add** — type `lunch 450`, `uber 280`, `netflix 199`; parsed into structured expenses with auto-category inference.
- **Expenses** — add / edit / delete with amount, category, date, payment method, tags, notes, and attachments (images / PDFs). Full history with search, time filters, category / payment / tag filters, sorting, and infinite scroll.
- **Analytics** — category breakdown (donut + list with totals, %, counts), time-range filters (today → custom range), payment-method filter, and auto-generated insights.
- **Insights** — top category, month-over-month trend, largest transaction, average daily / weekly spend.
- **Budgets** — overall monthly budget plus optional per-category budgets, with near-limit and over-budget alerts.
- **Recurring** — daily / weekly / monthly / yearly, auto-materialized when due; pause / resume / edit.
- **Bill splitting** — groups, members, equal / unequal / percentage splits, and minimum-transaction settlement optimization.
- **Reports** — CSV and PDF export for any time range.
- **Global search** — across expenses, categories, tags, notes, and groups.
- **Auth** — GitHub OAuth, Google OAuth, GitHub token, or on-device (local) mode.

## Tech

Next.js 15 (static export) · TypeScript (strict) · Tailwind CSS v4 · shadcn-style Radix primitives · Zustand · Zod · React Hook Form · Recharts · TanStack Table · Sonner · Vaul · Octokit · jsPDF · Vitest + Testing Library.

## Architecture

Strict separation of concerns:

```
lib/
├── domain/        Pure business logic — no React, no IO
│   ├── types.ts        Zod schemas + inferred types (single source of truth)
│   ├── quick-add.ts    Natural-language expense parser
│   ├── settlement.ts   Balance + minimum-transaction settlement
│   ├── recurring.ts    Frequency-aware materialization engine
│   ├── budget.ts       Overall + per-category budget summaries
│   ├── analytics.ts    Filtering, category breakdown, daily totals
│   ├── insights.ts     Auto-generated spending insights
│   ├── time-ranges.ts  Preset + custom date-range resolution
│   ├── reports.ts      CSV + report-data shaping
│   ├── money.ts        Integer-paise math (equal / unequal / percentage splits)
│   └── dates.ts        Calendar helpers
├── storage/       Data access (swappable adapters)
│   ├── adapter.ts             StorageAdapter interface
│   ├── local.ts               localStorage adapter
│   ├── github.ts              GitHub-repo adapter (Octokit)
│   ├── attachments.ts         IndexedDB attachment store
│   ├── github-attachments.ts  GitHub attachment store
│   ├── migrations.ts          Forward-compatible data migrations
│   └── repository.ts          Typed read/write over any adapter
├── auth/          OAuth + session
├── export/        Client-only CSV / PDF file generation
└── store/         Zustand store — the only bridge between UI and domain/storage
```

UI lives in `components/` (primitives in `components/ui`, bottom sheets in `components/sheets`, screens in `components/views`). Business logic never lives in components. Storage is behind the `StorageAdapter` interface, so the GitHub backend can be swapped for a real database without touching domain or UI code.

Data is stored as structured JSON:

```
data/
├── expenses.json
├── recurring.json
├── groups.json
├── budgets.json
└── settings.json
attachments/<id>.json   (base64 blobs, GitHub mode)
```

## Setup

```bash
npm install
npm run dev          # http://localhost:3000
```

Sign in with **Continue on this device** for a zero-config local trial (data in localStorage / IndexedDB).

### Environment variables

All optional — without them the app runs in on-device mode.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | GitHub OAuth app client id |
| `NEXT_PUBLIC_GITHUB_TOKEN_EXCHANGE_URL` | Endpoint that exchanges an OAuth `code` for a token (GitHub's token endpoint needs a server/worker for the secret) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client id (GIS) |
| `NEXT_PUBLIC_BASE_PATH` | Base path when hosting under a sub-path (e.g. `/ledger` on GitHub Pages) |

In GitHub mode the app creates a private `ledger-data` repository on first use and reads/writes JSON there via Octokit.

## Scripts

```bash
npm run dev        # dev server
npm run build      # static export to out/
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

## Backend (GitHub OAuth)

GitHub's OAuth token exchange needs a server to hold the client secret. A minimal **Cloudflare Worker** lives in [`worker/`](worker/README.md) and does only that. Deploy it, then point the frontend at it with `NEXT_PUBLIC_GITHUB_TOKEN_EXCHANGE_URL`. Everything else stays fully static. Without it, the app still works via the personal-access-token sheet and on-device mode.

## Deploy to GitHub Pages

```bash
NEXT_PUBLIC_BASE_PATH=/<repo> npm run build
```

Push the `out/` directory to your Pages branch (or use a Pages Action). Set the OAuth env vars as repository/Action secrets. The build is a fully static export — no server required (aside from the optional auth worker above).
