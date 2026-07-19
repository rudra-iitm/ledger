# 08 — Business Logic (Every Rule & Formula)

All logic lives in `lib/domain/` (pure, no IO). References are `file:line`.

## Money (`money.ts`)

- Amounts are stored as **decimal rupees in JS numbers**; integer **paise** are used transiently for split/settlement math (`toMinorUnits = round(amount·100)`).
- `roundMoney(x) = round(x·100)/100` applied at every aggregation boundary.
- Formatting: `Intl.NumberFormat("en-IN")` (lakh/crore grouping), symbol prefixed, 0 fraction digits for whole numbers else ≤2.
- **Equal split**: in paise, `base = floor(total/n)`; the first `total − base·n` participants get +1 paisa. Sum is exact.
- **Percentage split**: per-share `floor(total·pct/100)` paise, then round-robin +1 paisa from index 0 until the **full total** is allocated. Consequence: allocates 100% even if percentages sum <100; over-allocates if >100 — the UI (GroupExpenseSheet) enforces sum=100±0.01, the domain does not.
- **Unequal split**: raw `shares[].value` used verbatim; UI enforces sum == amount in minor units.
- Single-currency app: `Settings.currency` is one global display symbol; `Account.currency` is decorative; no FX.

## Balance engine (`balances.ts`)

```
balance = roundMoney(openingBalance + Σ over rows with date ≥ openingDate of sign · signedDelta(row))
sign = −1 for credit_card accounts, else +1
```

`signedDelta` per row relative to an account:

| Row type | Source (`accountId`) | Destination (`transferAccountId`/`paymentTargetId`) |
| --- | --- | --- |
| expense | −amount | — |
| income | +amount | — |
| transfer | −amount | +amount |
| cc_payment | −amount | +amount (to the card) |
| investment | −amount | +amount — **even when `affectsBalance=false`** (the holding leg always reflects the asset; balances.ts:14-16) |

`affectsBalance=false` zeroes every other case. The CC sign flip makes a card purchase *increase* the card balance (owed) and a payment *decrease* it — positive CC balance = debt.

- **Hard reset** = set `openingBalance` + `openingDate`; earlier rows become invisible to the balance without deleting history.
- **Net worth**: `assets = Σ balances of non-archived non-CC accounts` (negative bank balances do subtract); `liabilities = Σ max(0, balance) over non-archived CCs` (a card in credit does not add to assets); `netWorth = assets − liabilities`.
- **Credit metrics**: `availableCredit = creditLimit − max(0,balance)`; `utilization = min(100, round(max(0,balance)/creditLimit·100))` (live balance, not statement).
- **Statement status** (balances.ts:105-127): compares `statementBalance` to **all-time** `cc_payment` totals into the card — Paid if statement ≤0 or lifetime paid ≥ statement; Partially Paid if some paid; Unpaid otherwise. ⚠ No statement-period windowing (no `statementDate` field) — after the first cycle, cumulative payments ≥ any new statement, so status tends to stick at "Paid". Flagged as a correctness defect.
- `recomputeBalances` runs after every ledger mutation (`mutateLedger`), preserving object identity when unchanged.

## Spending classification (`transactions.ts`)

`isSpend ≡ (type ?? "expense") === "expense"` — **only true expenses count as spending** in budgets, analytics, spaces, calendar, review. Investments can *display* in expense lists via `settings.showInvestmentsInExpenses` but never count as spend.

## Group settlement (`settlement.ts`)

1. **Shares**: equal → `splitEqually`; percentage → member pct (missing ⇒ 0%) → `splitByPercentage`; unequal → raw values (missing ⇒ 0).
2. **Balances** (integer paise): participant −= share; payer += full amount; settlement: `from` += amount, `to` −= amount. Positive = creditor. Members deleted from the group are skipped.
3. **`optimizeSettlements`** — two-phase heuristic (min-transaction settlement is NP-hard; this is near-minimal):
   - *Exact-match pass*: any debtor whose debt equals a creditor's credit exactly (in paise) settles pairwise.
   - *Greedy two-pointer*: sort both sides descending; repeatedly transfer `min(debtor, creditor)`; ≤ D+C−1 transactions.

Paise-integer arithmetic guarantees balances sum exactly to zero.

## Recurring engines (three copies — see [13-code-quality.md](13-code-quality.md))

**Recurring expenses** (`recurring.ts`): `firstOccurrence` = `dayOfMonth` clamped into start month (or startDate for daily/weekly/yearly); `advance` = +1d / +7d / `addMonthsClamped(date, 1, dayOfMonth)` / +1y. The **persistent `dayOfMonth` anchor** means Jan 31 → Feb 28 → Mar 31 (no drift). `weekday`/`monthOfYear` schema fields are never consulted. Materialization walks from `lastMaterializedDate` (or first occurrence) to today — **full catch-up backfill**, including after un-pausing; 10,000-iteration guard. Materialized rows always `affectsBalance:true`. Kind mapping: income → `type:"income"` + `incomeCategory??"Other"`; transfer → category "Other"; cc_payment → category **"Bills"**, `paymentTargetId = item.transferAccountId`.

**Recurring investments** (`recurring-investments.ts`): same algorithm + **quarterly** (+3 months). Materialized row: `type:"investment"`, category "Investments", source `fromAccountId`, destination `investmentAccountId`, copies `units`, **respects the schedule's `affectsBalance`** — this is the SIP mechanism.

**Subscriptions** (`subscriptions.ts`): stored-pointer model — `nextRenewalDate` advanced in place, re-deriving the day anchor from the current date each time, so a Jan-31 subscription **permanently drifts to the 28th** after February. Costs: `monthlyCost` = weekly·52/12 | monthly | quarterly/3 | yearly/12; `annualCost = monthly·12`. Renewal alerts within 7 days.

**Upcoming feed** (`upcoming.ts`): 45-day horizon merging next-due of active recurring items, subscription renewals, SIP dates, and **CC bill events** (cards with `statementDueDate` and outstanding >0; amount shown = `minimumDue ?? statementBalance ?? outstanding`).

## Investments (`investments.ts`, `prices.ts`)

Holding = investment-type Account. `units` = Σ `row.units` over investment rows targeting the account (rounded 2dp — lossy for 3-4dp MF units; **units never decrease** — no sell leg). `invested = max(0, account.balance)`. `averagePrice = invested/units`. `currentValue = units·currentPrice`, falling back to `invested` when no price. `gain = currentValue − invested`; `gainPercent = gain/invested·100`. Portfolio = sums over non-archived, non-empty holdings. Goal progress = Σ (holding value | max(0,balance)) / target, capped at 1.

Price keys: `mf:<AMFI code>`, `stock:<yahoo ticker>`, `crypto:<coingecko id>`, `metal:gold|silver`; gold/silver need no priceId. `priceUpdates` only applies finite, positive, changed prices.

## Budgets (`budget.ts`)

Month spend = Σ spend rows in `YYYY-MM`. `remaining = budget − spent` (may go negative); `progress = min(1, spent/budget)` (1 if no budget but spent >0); `overBudget = budget>0 && spent>budget`; **`nearLimit = !over && progress ≥ 0.8`** — the 80% alert threshold. Category budgets only for categories with limit >0, sorted by progress. No rollover; space budgets are lifetime, not monthly.

## Analytics / insights / review (`analytics.ts`, `insights.ts`, `review.ts`)

- `filterExpenses` ANDs: range, category, accountId(s) (rows lacking `accountId` are dropped when an accounts list is given), spaceId, tags (all must match), free text. Text search is **brand-aware**: resolves a Brand from description+notes and matches name + aliases (searching "swiggy" hits "Bundl Technologies").
- Category breakdown: `{total, count, percentage = total/grand·100}`, nonzero only, sorted desc. Buckets: day / Monday-started week / month.
- Income analytics mirror the spend set; `incomeBucketed` retypes income rows as "expense" to reuse `bucketedTotals` (a hack).
- Insights (current vs previous month): top category; MoM trend `round((this−last)/last·100)` (tone: up=bad); largest transaction; **avg daily = monthTotal / elapsed days of month**; weekly = daily·7.
- Monthly review: **avg daily = monthTotal / full `daysInMonth`** (⚠ different definition from insights); `savingsRate = max(0, round((budget−spent)/budget·100))` — **budget-relative, not income-relative**; category changes `changePct` vs previous month sorted by |Δ|; top-5 spaces; account and subscription insights.

## Time ranges (`time-ranges.ts`, `dates.ts`, `calendar.ts`)

- Dates are `YYYY-MM-DD` **device-local** strings; all comparisons lexicographic. `parseISODate` = local midnight. Deviations: `rangeLength` parses with `new Date(iso)` (UTC — masked by rounding); `lastMonth` preset ends at the literal `"YYYY-MM-31"` (safe only lexicographically).
- `addMonthsClamped(date, n, dayOfMonth)` re-clamps to the original anchor — the primitive that keeps recurring from drifting.
- Weeks start Monday. `formatDisplayDate` omits the year for current-year dates (en-IN).
- Calendar: 6-week matrix from the Monday on/before the 1st; heatmap scaled by `maxDailyTotal`; spend rows only.

## Quick-add parser (`quick-add.ts`)

1. `#word` matching a category name (case-insensitive) → explicit category.
2. Amount: trailing preferred, else leading — `(rs.?|inr|₹|$)? digits[,ddd]*[.dd]?`; commas stripped; must be >0. Remainder = description; both required.
3. Category: explicit tag else first-keyword-wins over ~70 lowercased India-centric keywords (swiggy/zomato→Food, uber/ola/rapido→Travel, netflix/spotify→**Bills** — n.b. the brand registry maps them to Entertainment); fallback "Other".

## Spaces (`spaces.ts`)

Soft partition via `Expense.spaceId`; spend rows only; summary mirrors budget math against the space's lifetime budget.

## Registries

- **Brands** (`lib/brands/registry.ts`, ~52): aliases include legal entity names; `resolveBrand` strips UPI prefixes (`upi/`, `paytm-`, `phonepe-`, `gpay-`) then exact → substring match. Drives icons + search.
- **Institutions** (`lib/institutions/registry.ts`, ~55): banks/networks/wallets/brokerages with accent colors and domains; substring alias then word-boundary id match. Drives account branding.

## IDs (`id.ts`)

`createId()` = `crypto.randomUUID()` with a `Date.now().toString(36)+random` fallback. No prefixes except hand-written seeds (`acc-cash`, `acc-bank`).

## Invariants worth protecting (currently untested)

1. Split/settlement math sums exactly (paise integers).
2. `signedDelta` sign matrix × liability flip × `affectsBalance` — incl. the investment-destination exception.
3. Balances always derivable: `recomputeBalances` idempotent over any expense set.
4. Materialization idempotent-by-pointer; loop guards 10,000/1,000.
5. Migrations idempotent (run on every load).
