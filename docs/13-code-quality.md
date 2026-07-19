# 13 — Code Quality Review

Overall: a disciplined codebase — zero TODO/FIXME/console.log anywhere, strict TS, real layering, Zod-first types. The debt is concentrated in **duplication** and **stale claims**, not tangle.

## Architecture rule compliance ✅

The README's "business logic never lives in components" rule genuinely holds: all IO goes through the store; 50 components import `lib/domain` but only pure functions; exactly 2 components import `lib/storage` (attachment display helpers — a defensible grey area). Better than most codebases claiming this.

## Duplication (the main smell)

| Cluster | Evidence | Cost |
| --- | --- | --- |
| **Three recurrence engines** | `lib/domain/recurring.ts` (143 ln) / `subscriptions.ts` (138) / `recurring-investments.ts` (122) — same firstOccurrence/advance/materialize shape; 82 lines literally identical between two | Money-generating logic, copy-pasted, untested; behavioral drift already exists (subscription anchor drifts, recurring doesn't) |
| **Sheet-form boilerplate** | Identical non-blank lines: expense↔income **176**, recurring↔recurring-investment **151**, recurring↔subscription **155** | ~40-50% of each sheet is the same 10-16 `useState`s + reset-on-open effect + `Number(amount)` validation + submit/toast/finally + pending-attachment handling. A `useSheetForm` hook (or actually adopting the installed-but-unused react-hook-form + zod resolvers) deletes several hundred lines |
| **Store CRUD triplets** | ~12 near-identical add/update/delete action triplets in `app-store.ts` (1,304 ln) | Generic CRUD factory or entity slices; MED, not urgent — the file is repetitive, not tangled |
| Small | `DATA_REPO` defined twice; two `getTodayString()` duplicating `todayISO()`; two "average daily spend" definitions (insights: elapsed days; review: full month) | LOW |

## Dead code & stale claims

- **Unused deps** (zero imports): `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-table`, `@radix-ui/react-{checkbox,radio-group,scroll-area,switch}`.
- **README is stale**: claims Vitest + Testing Library (no tests exist), RHF, TanStack Table; documents 10 domain modules (24 exist) and 5 data files (11 exist); omits idb-keyval/qrcode/vaul; worker README predates the groups endpoint.
- Dead in live files: `normalizeShares` export, `AccountSelect.includeInvestment` prop, `BACKUP_VERSION` (written, never checked), `RecurringExpense.weekday/monthOfYear` + `RecurringInvestment.weekday` schema fields (never read), `Expense.debitCardId` (never set by UI), Worker `GET /health` + `vs=` param (no callers).
- Stray tracked files: `ib.png`, five create-next-app SVGs in `public/`.
- Empty placeholder dirs: `app/inbox/`, `components/receipt/` (untracked).

## Hardcoded values

- Locale `"en-IN"` in money/dates/insights/review/PDF export; default currency `"₹"` in schema defaults; currency picker = 4 symbols, display-only (no ISO codes, no FX); quick-add regex hardcodes `rs|inr|₹|$`. Fine for the intended user; means "currency setting" is cosmetic.
- SW `VERSION = "ledger-v1"` manual; `PAGE_SIZE 25`; 15s group poll; 45-day upcoming horizon; 80% budget alert threshold; 30-entry history cap; 50 MB UI attachment cap; 10,000/1,000 materialization guards. All reasonable but scattered — a `constants.ts` would help discoverability.

## Error-handling patterns

- Sheets consistently `toast.error` on failure ✅; silent catches for best-effort paths (prices, reminders) are deliberate ✅.
- ❌ `persist()` drops failed writes silently (badge only); `initialize()` catch-all signs out on any failure; `repository.readCollection` silently substitutes empty defaults on Zod failure (vs backup import which throws — inconsistent by design, but the silent side is the dangerous one).
- `downloadCsv` never revokes its object URL (its sibling `downloadJson` does).

## Naming & style

Consistent: kebab-case files, typed store interface, schema-first types, en-IN formatting helpers. Minor: worker named `ledger-auth` though it serves prices/push/groups; `mutateLedger` vs `mutate` distinction is undocumented but load-bearing (only `mutateLedger` recomputes balances).

## Testing — the largest single gap

Zero test files, zero test deps, no test script, no CI quality gates (build-only deploy workflow; lint/typecheck scripts exist but never run in CI). Priority order for a first test suite:

1. `money.ts` split math (equal/percentage remainder distribution)
2. `settlement.ts` (balances + optimizer)
3. `balances.ts` `signedDelta` matrix (5 types × source/dest × affectsBalance × CC flip, incl. the investment-destination exception)
4. `migrations.ts` (corrupts real data if wrong)
5. The three materialization engines (month-clamp date walks)
6. `backup.ts` parse/restore
