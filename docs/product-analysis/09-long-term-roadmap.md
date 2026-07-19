# 09 — Long-Term Roadmap (1 → 10 Years)

Backlog item numbers reference [07-feature-backlog.md](07-feature-backlog.md). Each year has a **theme**, a **promise** (what a user can newly say), and an honest **exit criterion**. Architecture evolution is deliberately staged — no year requires the next year's infrastructure.

## Year 1 — "It captures itself" (Trust + Ingestion)

**Theme**: make the ledger effortless to keep true. **Items**: 1–10, 22 (sync trust → inbox → rules → CSV import + dedup → CAS → lots → snapshots → CC cycles → EMIs → share-target; quick wins throughout).
**Promise**: *"I upload my statements and CAS monthly, share the odd UPI screenshot, and my ledger — including my mutual funds — is complete without typing."*
**Architecture**: current stack unchanged (static + worker + GitHub) with the sync-trust fixes; all parsing client-side.
**Exit criterion**: a month of real usage with **>90% of transactions entering via import/capture** and zero data-loss incidents. If dedup precision <95% on real statements, stop and fix before Year 2 — everything downstream compounds its errors.

## Year 2 — "It understands itself" (Documents + Intelligence + Tax)

**Theme**: from ledger to organized financial life. **Items**: 11–18, 20–21, 36 (payslips → vault → forecast → recurrence mining → tax v1 → BYOK AI + categorization → NL queries → email alias → demat imports → calendars).
**Promise**: *"Tax season is an afternoon: my capital gains, 80C proofs, TDS ledger, and every document are one export away. The app tells me about my money — price hikes, upcoming crunches, what changed this month — before I ask."*
**Architecture**: Cloudflare Email Workers added; vault may add optional object-storage backend for size; still no accounts/servers holding plaintext data.
**Exit criterion**: complete FY tax pack generated from real data and accepted by a real CA; email alias parsing ≥3 document types reliably.

## Year 3 — "It plans with me" (Planning apps + Platform seed)

**Theme**: spend the accumulated truth. **Items**: 23–35 selectively (FI planner → scenarios → insurance → health score → receipts OCR → anomalies → year-in-review → term deposits → ESOP/RSU → custom categories → multi-currency v1 → debt payoff), 53-seed (public DSL API).
**Promise**: *"I know my FI number from my actual spending, what happens if I lose my job or buy the house, and what to fix next — with every assumption on the table."*
**Decision gate (deliberate)**: the **entity question** — hosted sync, email infrastructure at scale, and any AA ambition require a legal entity and revenue ([08](08-product-vision.md) business stance). Decide here: stay a sovereign personal tool (fine! the architecture allows it) or productize. Everything below assumes productize; if not, Years 5–10 shrink to the single-user column.

## Year 5 — "It's ours" (Household + Sovereign sync)

**Theme**: the hardest migration, done once, properly. **Items**: 50 (E2E-encrypted op-log sync — Durable Objects or user object storage; GitHub demoted to export/audit), 49 (household: identities, shared/private partitions, roles, child accounts), 19-completed groups convergence, 51 (estate & continuity: nominees, completeness checklist, inactivity-triggered emergency access — the Kubera "life beat", on infrastructure that already exists as worker cron + push), 54 (CA/advisor scoped sharing), 55 (education/purchase planners).
**Promise**: *"My spouse and I run shared money with private space each; my CA sees exactly the tax pack and nothing else; if something happens to me, my family gets the keys automatically."*
**Exit criterion**: two-person household on E2E sync for 6 months with zero conflict-loss; a successful simulated estate handover.
**Honest risk**: this year fails if attempted before sync trust is boring. Household on LWW = divorce-by-data-loss.

## Year 10 — "It's infrastructure" (Ecosystem + Longevity)

**Theme**: the OS outlives its authors. **Items**: 52 (AA integration via TSP — by now either table stakes or proven unnecessary by document flows; adapter seam means it's a driver, not a rewrite), 53 (plugin platform: community bank-parser packs, custom cards, webhooks), 46, 48 (local-model extraction as default — by 2036 on-device models will handle every parsing task, deleting the BYOK compromise), format standardization (publish the schema; other tools read/write it), decade features: 15-year analytics, generational handover (a child's first account seeded from the family OS), archival guarantees (open spec + exporters such that the data remains readable in 2050).
**Promise**: *"Fifteen years, three phones, two banks, one divorce-proof source of truth — and if the app disappeared tomorrow, my data wouldn't."*

## Cross-year guardrails

- **Sequencing law**: trust → ingestion → understanding → planning → sharing → ecosystem. Skipping a stage amplifies the previous stage's defects (worst case: automation before sync trust = automated data loss).
- **The kernel doesn't fork**: every year's entities are new DataFiles + Zod schemas on the same store discipline the audit verified; the day a feature demands its own datastore is the day it gets redesigned.
- **Annual moments are sacred**: each year must strengthen February (tax) and April (FY planning) — the retention physics of this category ([02](02-user-pain-points.md)).
- **Kill criteria, pre-committed**: dedup precision <95% → halt ingestion expansion; household sync loses one family's data → freeze features for a trust-only quarter; any monetization path that requires reading user data in plaintext → rejected regardless of revenue.
