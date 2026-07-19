# 18 — Developer Onboarding Guide

## Setup

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run lint
npm run build        # static export → out/  (serve with: npx serve out -l 4173)
```

Zero-config trial: sign in with **Continue on this device** (localStorage + IndexedDB, no env vars needed). For GitHub mode locally, either paste a PAT (easiest — a fine-grained token with contents read/write on one repo works) or set up the OAuth env vars below.

Env vars (all optional; the four commented ones are undocumented in `.env.example`):
`NEXT_PUBLIC_GITHUB_CLIENT_ID`, `NEXT_PUBLIC_GITHUB_TOKEN_EXCHANGE_URL` (also the base URL for prices/push/groups!), `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_BASE_PATH`, plus `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_PRICES_URL`, `NEXT_PUBLIC_PUSH_URL`, `NEXT_PUBLIC_GROUPS_URL`.

Worker: `cd worker && npm install && npx wrangler dev` (secrets via `.dev.vars`, see `.dev.vars.example`; deploy with `wrangler deploy` — there is no CI for it).

⚠ `AGENTS.md` warns that this Next.js 15 differs from prior knowledge — read `node_modules/next/dist/docs/` before writing framework-touching code.

## The one mental model you need

```
Zod schemas (lib/domain/types.ts)  =  the truth about data shapes
lib/domain/*   = pure functions; no React, no IO — put ALL business rules here
lib/storage/*  = StorageAdapter (11 named JSON files) + repository (parse→migrate→validate)
lib/store/app-store.ts = the ONLY bridge; every mutation + persistence lives here
components/*   = render store state, call store actions, compute derived values via lib/domain
```

Golden rules observed by the existing code — keep them true:
1. Never mutate `Account.balance` directly — change expenses and let `mutateLedger` → `recomputeBalances` derive it. (`mutate` does NOT recompute; use `mutateLedger` for anything touching money movement.)
2. "Spending" means `type === "expense"` only (`isSpend`) — don't count income/transfers/cc_payments/investments in spend metrics.
3. Money: decimal rupees + `roundMoney` at aggregation; split/settlement math in integer paise.
4. Dates: `YYYY-MM-DD` device-local strings, lexicographic comparison, `todayISO()` — never `new Date().toISOString().slice(...)`.
5. New entity? Add: Zod schema + file entry (`types.ts`), `DataFile` name (`adapter.ts`), repository schema map + defaults, migration default case, store actions, backup include — then UI.
6. Domain modules must stay React-free and IO-free.

## Adding a typical feature (worked example: a new sheet-based entity)

1. Schema + `*FileSchema` in `lib/domain/types.ts`; pure helpers in a new `lib/domain/<entity>.ts`.
2. Register the file name in `lib/storage/adapter.ts` and `repository.ts` (`FILE_SCHEMAS`, `EMPTY_DATA`, `loadAll`).
3. Store actions in `app-store.ts` following an existing triplet (`addX/updateX/deleteX` via `mutate`).
4. Sheet in `components/sheets/` + register in `sheet-context.tsx` (`ActiveSheet` union + `openX`).
5. View in `components/views/` + thin `app/<route>/page.tsx` wrapping it in `AppShell`.
6. If it produces future-dated events, wire into `lib/domain/upcoming.ts` (calendar + reminders follow automatically via PwaManager).

## Debugging tips

- Sync issues: watch the header dot; `syncStatus:"error"` means a write was **dropped** (known debt). GitHub mode: check the `ledger-data` repo's commit history — every write is a commit, which is also your data-recovery path.
- "My data vanished": almost certainly the silent Zod-fallback ([14](14-technical-debt.md) #2) — recover from `ledger-data` git history.
- Prices/push/groups silently off: `NEXT_PUBLIC_GITHUB_TOKEN_EXCHANGE_URL` unset, or the corresponding Worker binding missing.
- Reminders: events cache lives in Cache API `ledger-v1-reminders` key `/__ledger_reminders__`; the Worker only knows dates.

## Glossary

| Term | Meaning |
| --- | --- |
| **DataFile** | One of 11 named JSON collections (`expenses`, `accounts`, …) |
| **Expense** | The universal transaction row; `type` ∈ expense/income/transfer/cc_payment/investment |
| **affectsBalance** | Row flag: false ⇒ no balance effect — except the investment *destination* leg, which always posts |
| **openingBalance/openingDate** | Balance seed + cutoff; together the "hard reset" mechanism |
| **mutateLedger** | Store helper that patches expenses/accounts then re-derives all balances |
| **Materialization** | Turning recurring/subscription/SIP templates into concrete Expense rows on load (catch-up backfill) |
| **Space** | A budget bucket (trip/project) tagging expenses via `spaceId` |
| **Group / selfMemberId** | Split-expense group; which member is the local user |
| **remoteId / rev** | Shared-group sync: Worker KV id (capability URL) + optimistic revision |
| **Holding** | An `investment`-type Account; units from investment rows, invested = its balance |
| **Quick add** | NL parser: `lunch 450` → amount/description/inferred category |
| **Data-less push** | Worker pushes an empty ping; the SW composes the notification from locally cached events |
| **LWW** | Last-writer-wins — the GitHub adapter's (dangerous) conflict resolution |

## Read next

[01-project-overview.md](01-project-overview.md) → [02-architecture.md](02-architecture.md) → [08-business-logic.md](08-business-logic.md) → [09-state-management.md](09-state-management.md), then [14-technical-debt.md](14-technical-debt.md) before changing anything.
