# 04 — AI Features (Real Value, No Gimmicks)

## Doctrine

1. **Deterministic first, AI second.** Everything computable from the ledger (balances, trends, forecasts, scores) is computed by pure `lib/domain` functions; AI *narrates, extracts, and interprets* — it never does arithmetic the domain layer can do, and never writes to the ledger without a confirmed draft. This keeps every number auditable ("explain" always resolves to a formula + rows) and is the difference between a finance OS and a chatbot wearing one.
2. **Privacy architecture before features.** A static, self-hosted-ish app has three options for LLM access, all worth supporting:
   - **BYOK** (user's Anthropic/OpenAI key, stored like the GitHub token, calls direct from client) — the power-user default; zero data through project infrastructure.
   - **Local models** (WebGPU in-browser, or Ollama endpoint for desktop users) — for extraction/classification tasks small models handle well; the only option some privacy-maximalists will accept.
   - **Worker proxy with metered keys** — only if the product ever becomes hosted SaaS; not before.
   Data minimization always: send schemas/aggregates/redacted narrations, not the raw ledger, unless the user opts a specific document in.
3. **Every AI output is labeled, sourced, and correctable** — and corrections become training signal for the *rules engine* (deterministic), not fine-tuning (opaque).

## Feature set, ranked by value-per-complexity

### 1. Smart categorization with learning (highest ROI)
Three tiers: brand registry + narration grammar (exists/extend, deterministic) → **user rules engine** (auto-generated from corrections: "You've recategorized Blinkit → Groceries 3× — make it a rule?") → LLM fallback for the unmatched tail (batch, BYOK, returns category + confidence; low confidence lands in inbox). The learning loop is rules, not weights: inspectable, editable, exportable. This multiplies every import in [03-automation-strategy.md](03-automation-strategy.md).

### 2. Document extraction (the automation enabler)
The tier-3 fallback for statements/payslips/CAS/policies when deterministic parsers miss: fixed JSON extraction schemas per document type, client-side redaction before sending, side-by-side verification UI. LLMs are genuinely best-in-class here, and the task is bounded + verifiable — the ideal AI job.

### 3. Natural-language queries — as a compiler, not an oracle
"What did I spend on restaurants last year?" / "all Amazon purchases" / "compare this month with last Diwali":

- **Architecture**: LLM translates the question into a typed **query DSL** (filters + group-by + compare — a superset of the existing `filterExpenses` params, incl. named Indian date anchors like Diwali/FY/quarter), the DSL executes **locally** against the ledger, results render as the existing list/chart components with the compiled query *shown* (tap to edit as filters).
- Why not RAG/raw-LLM-over-data: context limits at 5 years of data, hallucinated numbers, no auditability, full-ledger exfiltration per question. The compiler pattern sends only the question + schema, executes on-device, and every answer is reproducible. Sub-second follow-ups ("only 2027", "by month") are DSL edits.
- Bonus: saved queries become custom dashboard cards — power-user catnip, zero extra engine.

### 4. Monthly/annual review narration
The review engine already computes everything; an LLM turns the month's stat block + anomalies into 5 honest sentences ("Dining doubled — 9 of 14 orders were weekday lunches; your Goa space drove 60% of the overshoot") with each claim linked to its rows. Annual version = the retention weapon (year-in-review). Falls back gracefully to today's numeric review without a key.

### 5. Anomaly & waste detection (statistical core, AI voice)
Deterministic detectors: per-merchant/category z-scores, duplicate-charge detection (same merchant+amount <48h), subscription price-hikes, gray charges (recurring merchant never confirmed), forex/convenience-fee accumulation, dormant-subscription flag (paying but no related activity). LLM only writes the alert copy. These land in the inbox with the same confirm/dismiss/rule loop.

### 6. Financial health score — explainable or not at all
A composite of **six deterministic sub-scores**, each with a formula page: savings rate (income-relative — fixing the current budget-relative metric), emergency-fund months (liquid ÷ avg monthly essential spend), debt service ratio (EMIs+CC ÷ income), diversification (concentration across asset classes/single stocks), insurance adequacy (term cover ÷ 10–15× income heuristic; health cover floor), goal funding ratio. No ML, no black box — the score is a *checklist with weights*, its entire value is "what do I fix next", and each sub-score deep-links to the fixing surface. Trend it monthly via the net-worth snapshots.

### 7. Cash-flow prediction & scenario narration
The deterministic forecast engine (03/Automation 4) plus scenario simulation ([08-product-vision.md](08-product-vision.md)): AI's role is *setup and narration* — "what if I lose my job?" compiles to scenario parameters (income→0, essentials-only spend, runway from liquid assets) the engine runs; the answer is a chart + "11 months at essential spend; 7 keeping SIPs" with assumptions listed and editable. Never let the LLM produce the numbers.

### 8. Budget & goal coaching
Grounded suggestions only: budget proposals from actual trailing medians (not aspirations), goal-feasibility checks ("₹40L in 4y needs ₹71k/mo at 8% — current pace ₹45k"), tax-saving nudges in Jan–Mar from the deductions ledger ("80C at ₹87k of ₹1.5L"). Tone principle from YNAB's success: coach, never scold; every nudge dismissible and rate-limited.

## Explicitly rejected

- **Chat-first UI** — chat is a query input, not the app. Structured surfaces win for money.
- **AI-written transactions without confirmation** — breaks the vouched-ledger contract.
- **Predictive auto-budgets that move money/targets silently** — control is the brand.
- **Sentiment/behavioral profiling** ("you spend when sad") — creepy, unfalsifiable, churn-inducing.
- **Fine-tuned custom models** — maintenance burden dwarfs benefit at this scale; rules + prompts + small local models cover it.

## Sequencing note

1 → 2 ride the automation build (Year 1). 3 → 4 need only BYOK plumbing + the DSL (late Year 1). 5 → 6 → 7 → 8 stack on snapshots + forecast (Year 2). The BYOK settings panel, redaction utilities, and "AI activity log" (every call, what was sent, one screen) are the shared substrate to build first.
