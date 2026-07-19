# 03 — Folder Structure

## Top level

| Path | Purpose |
| --- | --- |
| `app/` | Next.js App Router routes. Every route is a thin server `page.tsx` wrapping a client view in `AppShell` (except `/login`, `/auth/callback`). Detail pages use query params (`?id=`) because of static export. |
| `components/` | All UI. Subdirs: `ui/` (13 shadcn-style primitives), `views/` (17 screens), `sheets/` (18 bottom sheets + `sheet-context.tsx`), `fields/` (form fields), `charts/` (2 Recharts wrappers), `auth/`, plus ~15 standalone components. |
| `lib/domain/` | 24 pure business-logic modules — no React, no IO. `types.ts` (Zod schemas) is the data-model source of truth. |
| `lib/storage/` | `adapter.ts` (interface), `local.ts`, `github.ts`, `repository.ts` (parse→migrate→validate), `migrations.ts`, `attachments.ts` (IndexedDB), `github-attachments.ts`. |
| `lib/store/` | `app-store.ts` (1,304 lines) — the single Zustand store. |
| `lib/auth/` | Session persistence + GitHub OAuth/PAT + Google GIS flows. |
| `lib/groups/` | `sync.ts` — shared-group protocol client (Worker `/groups`). |
| `lib/pwa/` | `reminders.ts` — push subscription + reminders cache. |
| `lib/export/` | `backup.ts` (JSON backup/restore), `files.ts` (CSV/PDF download). |
| `lib/brands/` | ~52-brand merchant registry (aliases incl. legal entity names, UPI prefix stripping) for icons + search. |
| `lib/institutions/` | ~55-entry bank/network/wallet/brokerage registry for account branding. |
| `worker/` | Independent Cloudflare Worker package: `src/index.ts` (router + OAuth exchange + prices route), `src/prices.ts`, `src/push.ts`, `src/groups.ts`. |
| `public/` | `sw.js` (hand-written service worker), `icon.svg`, plus **unused create-next-app leftovers** (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`). |
| `.github/workflows/deploy.yml` | GitHub Pages deploy (build only, no quality gates). |
| `docs/` | This audit documentation. |

## Route inventory (`app/`)

Tabs: `/` (Dashboard), `/calendar`, `/analytics`, `/expenses`. Secondary (avatar menu / shortcuts): `/accounts`, `/account?id=`, `/investments`, `/investments/transactions`, `/spaces`, `/space?id=`, `/groups`, `/group?id=`, `/groups/join?code=`, `/lend-borrow`, `/lend-borrow/new`, `/lend-borrow/detail?id=`, `/lend-borrow/person/detail?name=`, `/recurring`, `/subscriptions`, `/reviews`, `/reports`, `/settings`. Bare: `/login`, `/auth/callback`. Full details in [10-ui-inventory.md](10-ui-inventory.md).

## Notable file-level facts

- **Largest file**: `lib/store/app-store.ts` (1,304 lines — a 200-line typed interface + ~50 actions; repetitive rather than tangled).
- **Data files** (GitHub mode → `data/<name>.json`, local mode → `localStorage["ledger:data:<name>"]`): `expenses, recurring, groups, budgets, settings, accounts, spaces, subscriptions, lendBorrows, recurringInvestments, goals` — 11 named files (`lib/storage/adapter.ts:1-13`).
- **Attachments**: GitHub mode `attachments/<id>.<ext>` (legacy fallback `attachments/<id>.json`); local mode IndexedDB keys `ledger:attachment:<id>`.

## Dead / stray / placeholder items

| Item | Status |
| --- | --- |
| `app/inbox/`, `components/receipt/` | **Empty, untracked directories** — no files, no git history. Placeholder scaffolding for planned features (inbox screen; receipt components). |
| `ib.png` (root, 726 B) | Tracked, zero references. |
| `public/next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg` | Tracked create-next-app leftovers, zero references. |
| `tsconfig.tsbuildinfo`, `.DS_Store` | Present on disk; correctly untracked/ignored. |
| `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-table`, 4 Radix pkgs | Installed, never imported. |
| `AccountSelect.includeInvestment` prop, `normalizeShares` export, `BACKUP_VERSION` check | Dead code within live files. |
| `.agents/skills/refero-design` | Local agent-skill config, unrelated to the app. |

## Duplicate code (see [13-code-quality.md](13-code-quality.md) for detail)

- Three copy-pasted recurrence/materialization engines: `lib/domain/recurring.ts`, `subscriptions.ts`, `recurring-investments.ts` (~82 identical lines between two of them).
- Sheet-form boilerplate: `expense-sheet` vs `income-sheet` share 176 identical non-blank lines; `recurring-sheet` vs `recurring-investment-sheet` 151; `recurring-sheet` vs `subscription-sheet` 155.
- `DATA_REPO = "ledger-data"` constant defined twice (`lib/storage/github.ts:4`, `github-attachments.ts:4`).
- Two `getTodayString()` helpers in lend-borrow pages duplicating `todayISO()`.

## Generated / legacy code

No generated code is checked in (Next build output is ignored). The only legacy-compat code paths are intentional: `lib/storage/migrations.ts` shape-normalizers and the `attachments/<id>.json` legacy attachment format fallback (`lib/storage/github-attachments.ts:53,103-110`).
