# 07 — Feature Backlog

Format per item: **Problem → Value → Deps → Cx** (S/M/L/XL) **→ Risks**. Ordering within tiers ≈ build order. Engineering effort assumes the current codebase and one strong engineer; Cx includes design.

## MUST HAVE (the trust + ingestion core — nothing above matters without these)

1. **Sync trust bundle** — offline boot ≠ sign-out; persisted outbox with retry; conflict detect-and-merge (or at minimum detect-and-warn) on GitHub writes; actionable sync status. *Problem*: silent data loss (audit P0s). *Value*: the product's word. *Deps*: none. *Cx*: M. *Risk*: merge edge cases — mitigate with op-log design + tests first.
2. **Review Inbox** (`app/inbox/`) — drafts, dedup confirmations, anomaly alerts, digest badge. *Problem*: automation needs a consent surface. *Deps*: none (alerts can feed it pre-automation). *Cx*: M.
3. **Rules engine** — match (merchant/narration/amount/account) → set category/tags/space/rename; auto-suggested from corrections. *Deps*: 2. *Cx*: M. *Risk*: rule-order conflicts — keep first-match-wins + a test panel.
4. **CSV/XLSX statement import** with per-account column-mapping profiles + dedup engine + provenance (lineHash). *Problem*: pain point #1. *Deps*: 2, 3. *Cx*: L. *Risk*: dedup false-merges — thresholds conservative, merges reversible.
5. **MF CAS import** (CAMS/KFintech). *Problem*: investment truth decay. *Value*: full MF automation in one feature. *Deps*: 2; lots (6). *Cx*: M–L. *Risk*: format drift — version the parser, fail to inbox not silence.
6. **Lots + sell legs + realized P&L**. *Problem*: portfolio can only grow; tax blocked. *Deps*: none (kernel work). *Cx*: M. *Risk*: migration of existing units-only data — synthesize opening lots.
7. **Net-worth + holdings monthly snapshots**. *Deps*: none. *Cx*: S. Feeds everything in Intelligence.
8. **Statement-cycle records for credit cards** (fixes stuck-"Paid"; cycle history). *Cx*: M.
9. **Loan/EMI accounts** (principal/rate/tenor, amortization split, Upcoming + forecast integration). *Cx*: M.
10. **PWA share-target + paste capture** (SMS text, UPI screenshots → OCR/narration-decode → draft). *Problem*: capture-at-moment. *Deps*: 2, 3. *Cx*: M. *Risk*: OCR quality — text-share first, screenshots second.

## HIGH PRIORITY (the OS takes shape)

11. **Payslip pipeline + SalaryRecord** (income txn match, EPF/NPS auto-holdings, TDS ledger, salary timeline). *Deps*: 2, vault (12). *Cx*: L.
12. **Document vault** (typed, FY-tagged, linked, searchable; extends attachments). *Cx*: M. *Risk*: repo size — size caps + optional object-storage backend later.
13. **Cash-flow forecast** (90-day projected balances, dip alerts). *Deps*: 7, 9 help. *Cx*: M.
14. **Recurrence miner** (detect subscriptions/EMIs/mandates from history; change alerts). *Deps*: 3, 4. *Cx*: M.
15. **Tax layer v1** — FY dashboard: realized gains (from 6), deduction tagging (80C/80D/HRA), TDS ledger, advance-tax calendar, CA export pack. *Deps*: 5, 6, 11, 12. *Cx*: L. *Risk*: tax-rule churn — ship as *organizer*, not calculator; rules data-driven per FY.
16. **BYOK AI substrate + smart categorization fallback + AI activity log**. *Deps*: 3. *Cx*: M.
17. **NL query DSL + compiler** (saved queries → dashboard cards). *Deps*: 16. *Cx*: L.
18. **Email forwarding alias** (Cloudflare Email Workers; CAS/card-bill/dividend parsers; E2E-encrypted drafts). *Deps*: 2, 5, 8. *Cx*: M–L. *Risk*: deliverability/abuse — per-user tokens, sender allowlists.
19. **Groups v2** — tombstones, edit propagation, rename/member-remove, back-dating, per-group write tokens. *Cx*: M.
20. **Broker/demat imports** (NSDL/CDSL CAS, Zerodha tradebook). *Deps*: 6. *Cx*: M.
21. **Reminder lead-times + ICS subscribe feed + tax calendar**. *Cx*: S–M.
22. **Quick wins basket** — search deep-links + tag search; income-relative savings rate; Google-login honest copy; debit-card picker; week pager; snapshot-powered net-worth chart. *Cx*: S each.

## MEDIUM PRIORITY (depth + planning apps)

23. **FI/retirement planner** (FI number from actual spend, coast/lean/fat, SWR bands; Monte Carlo later). *Deps*: 7, 13. *Cx*: M–L. *Risk*: implied advice — assumptions editable + disclaimers; no product recommendations.
24. **Scenario engine** ("job loss", "8% inflation", "retire at 45", "buy house" with EMI/opportunity-cost). *Deps*: 13, 23. *Cx*: L.
25. **Insurance registry** (policies in vault, renewals, adequacy heuristics). *Deps*: 12. *Cx*: S–M.
26. **Financial health score** (six explainable sub-scores + trend). *Deps*: 7, 13, 25. *Cx*: M.
27. **Receipt OCR** (`components/receipt/`) with line items. *Deps*: 10. *Cx*: M–L.
28. **Anomaly/waste detectors** (dupes, hikes, gray charges, fee accumulation). *Deps*: 14. *Cx*: M.
29. **Review narrations (AI) + year-in-review**. *Deps*: 16, 7. *Cx*: M.
30. **Term deposits** (FD/RD/SGB: interest accrual, maturity). *Cx*: M.
31. **ESOP/RSU vesting schedules** (vest events = income + holding + tax flag). *Deps*: 6. *Cx*: M.
32. **EPF/NPS statements** (passbook/CRA parsers; payslip-estimated interim). *Deps*: 11. *Cx*: M.
33. **Custom categories / category editor** (with migration + keyword/rule remap). *Cx*: M. *Risk*: analytics continuity — keep canonical parents for old data.
34. **Debt payoff planner** (avalanche/snowball, prepayment what-ifs). *Deps*: 9. *Cx*: S–M.
35. **Multi-currency v1** (ISO codes, per-account currency, display FX; foreign stocks/RSUs). *Cx*: L. *Risk*: touches every formatter — do behind a long flag.
36. **Guided statement reconciliation** (closing-balance diff → unmatched-row workbench). *Deps*: 4. *Cx*: M.

## NICE TO HAVE

37. Sankey annual cash-flow view · 38. Merchant/tag analytics pages · 39. Envelope-budget optional mode · 40. Regular-vs-direct MF fee X-ray (from CAS) · 41. Voice capture · 42. Widgets/shortcuts (PWA limits apply) · 43. Credit-score log (manual/CIBIL-report import) · 44. Trip mode (space + currency + share-target preset) · 45. Data-quality dashboard (unmatched provenance, stale prices, dangling refs) · 46. Community parser registry (bank formats as data packs) · 47. Financial journal / investment theses linked to trades · 48. Local-model (WebGPU/Ollama) extraction option.

## FUTURE VISION (needs Layer-0 evolution or a legal entity — see [09](09-long-term-roadmap.md))

49. **Household/family** — multi-identity, shared + private ledgers, roles, child accounts, education planning. *Deps*: E2E-encrypted sync service (50). *Cx*: XL. *Risk*: the hardest migration in the roadmap; design keys/partitioning before building UI.
50. **E2E-encrypted sync service** (op-log CRDT on Durable Objects or user object-storage; GitHub demoted to export/audit copy). *Cx*: XL.
51. **Estate & continuity** — nominee registry, completeness checklist, sealed instructions, inactivity-triggered emergency access (worker cron + push infra exist). *Deps*: 12, 50 for sharing. *Cx*: L. *Risk*: get a lawyer's review; never generate wills, only organize them.
52. **Account Aggregator integration** (via TSP; requires entity + compliance). *Deps*: 50 + a business decision. *Cx*: XL.
53. **Plugin/API platform** (public DSL API, custom cards, third-party parsers, webhooks). *Deps*: 17. *Cx*: L–XL.
54. **Advisor/CA portal** (scoped read-only share of tax pack/portfolio). *Deps*: 49-era sharing. *Cx*: L.
55. Children's-education & big-purchase planners (goal templates over 23/24). *Cx*: M.
