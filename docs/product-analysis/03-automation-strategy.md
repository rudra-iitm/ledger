# 03 — Complete Automation Strategy

**North star: the user confirms; the system captures.** Every automation below lands as a *draft with provenance* in a **Review Inbox** (the existing `app/inbox/` placeholder), never as a silent write. Confidence ≥ high → one-tap batch confirm; low → individual review. This preserves the app's core trust property (a ledger the user vouches for) while removing typing.

## Architectural spine (applies to every automation)

```
Source (file / share / paste / email / API)
  → Ingestion adapter (per-format parser; client-side by default)
  → Normalizer (→ DraftTransaction/DraftDocument with provenance + confidence)
  → Rules engine (user-defined: match → categorize/tag/route/rename)
  → Deduplicator (against ledger + other drafts)
  → Review Inbox (batch confirm / edit / reject / "always do this" → new rule)
  → Ledger write (existing store actions) + Document Vault (raw source archived)
```

**Non-negotiables**: (1) parsing runs **client-side** wherever possible — statements never leave the device; (2) every ingested row carries `source[]` provenance (`{kind, docId, lineHash}`) making re-imports idempotent and every number auditable; (3) LLM use is a *fallback* behind deterministic parsers, and is **BYOK or local** (see [04-ai-features.md](04-ai-features.md)); (4) the raw document is always archived in the vault — the parse can be wrong, the source never is.

**New entities required**: `DraftTransaction`, `Document` (vault), `Rule`, `ImportBatch`, `SalaryRecord`, `Instrument/Lot` (see sell-leg work), `Policy` (insurance). All follow the existing Zod-schema + DataFile pattern.

---

## Automation 1 — Bank statement import (the workhorse)

**Formats, in priority order** (deliberately *not* PDF-first):
1. **CSV/XLSX** — every Indian bank exports it; deterministic column-mapper per bank (HDFC/ICICI/SBI/Axis/Kotak templates cover ~80% of users), with a generic "map your columns once" wizard that saves the mapping as a per-account profile.
2. **Delimited-text/Excel credit-card statements** — same path.
3. **PDF** — client-side text extraction (pdf.js); bank-specific line parsers; password-protected PDFs (standard for Indian banks — typically PAN/DOB-derived) unlocked locally with a stored-per-account password hint. LLM extraction only when the deterministic parser fails, on redacted text (numbers/dates kept, names optionally masked) and only with user consent.

**Classification during parse** (deterministic, no ML needed for 90%):
- **Narration decoder** — the existing brand registry + UPI-prefix machinery is already half of this. Extend with bank-narration grammars: `UPI/<vpa>/<ref>/<note>`, `NEFT/IMPS/RTGS-<ref>-<name>`, `ACH/NACH-<mandate>` (⇒ EMI/SIP/insurance), `ATW/ATM` (⇒ cash withdrawal = transfer to Cash account), `POS/ECOM`, `INT.PD`/`CREDIT INTEREST` (⇒ income:Interest), `SAL`/employer name (⇒ salary candidate), reversal/refund markers (`REV`, `REFUND` ⇒ negative-linked to original).
- **Transfer detection** — a debit in account A and credit in account B, same amount, ≤2 days apart, both present in imports or ledger ⇒ propose a single `transfer` row (merging the two legs). Same logic identifies CC-payment legs (credit on card statement + debit on bank).
- **Recurrence mining** — see Automation 4.

### Duplicate-detection algorithm (design)

Two distinct problems: **(a)** statement row vs *manually entered* transaction; **(b)** statement row vs *previously imported* row.

**(b) is solved exactly**: `lineHash = sha256(accountId | postingDate | amount | normalizedNarration | refNo)` stored in provenance; re-importing an overlapping statement is a no-op. Never fuzzy-match what you can hash.

**(a) needs scoring.** Candidate generation: same account (or account unset on the manual entry) AND amount within ₹1 or 0.5% AND date within ±4 days (manual entries use spend-date; statements use posting-date — card postings lag 1–3 days). Then score:

| Signal | Weight | Notes |
| --- | --- | --- |
| Reference/UPI ref exact match | auto-merge | short-circuit, no further scoring |
| Amount exact | 0.35 | ±tolerance scores 0.25 |
| Date proximity | 0.20 × decay | 1.0 same-day → 0.4 at ±4d |
| Merchant/narration similarity | 0.30 | both sides resolved through the brand registry first (canonical brand id match = full score); else token-set Jaccard on normalized narration (strip refs/numbers/UPI ids) + trigram similarity for typos |
| Same VPA / same debitCard | 0.10 | |
| Category agreement | 0.05 | weak signal — user may have "corrected" it |

Thresholds: **≥0.90 auto-merge** (statement enriches the manual row: adds refNo, posting date, provenance; manual description/category/tags win); **0.60–0.89 → inbox pair-review** ("same transaction?" side-by-side, one tap); **<0.60 new draft**. Merge is a union, never a delete — and a merged row keeps both sources so a later re-import stays idempotent. One manual row can match at most one statement row per batch (Hungarian-style greedy on scores prevents double-claiming).

**Cadence**: works identically for weekly/monthly/quarterly/yearly uploads — the lineHash + reconciliation summary ("statement says closing ₹X, ledger says ₹Y, 3 rows unmatched") makes each import a *reconcile event*, finally giving reconcile the statement it always needed.

---

## Automation 2 — Salary & payslip pipeline

Payslips are the most *structured* recurring document a user owns — deterministic-friendly.

**Pipeline**: upload payslip PDF (vault it) → parser tier 1: per-payroll-provider templates (a handful of vendors — greytHR, Keka, Darwinbox, Zoho Payroll, ADP — cover most Indian salaried users; each has a stable layout) → tier 2: table-extraction heuristics (label:value pairs — Basic, HRA, Special Allowance, PF, Professional Tax, TDS…) → tier 3: BYOK LLM on the text with a fixed extraction schema. Confidence per field; the review screen shows the payslip side-by-side with extracted fields.

**Produces a `SalaryRecord`** (new entity): `{employer, period, gross, net, components{basic, hra, allowances[]}, deductions{pf_employee, pf_employer, nps_employer, pt, tds, other[]}, regime?, creditedAccountId?, docId}`.

**Automatic fan-out on confirm** (each its own draft, batch-confirmable):
1. **Income transaction** for net pay — dedup-matched against the bank credit if a statement already imported it (the salary record then *enriches* rather than duplicates).
2. **EPF contributions** (employee + employer) → investment rows into an EPF holding account; NPS likewise. This fixes pain point #3's "nobody backfills EPF".
3. **TDS ledger entry** → tax layer (running TDS vs eventual Form 16/26AS check).
4. **Salary history timeline** → income analytics: YoY growth, component evolution, employer history, "highest salary" finally answerable.
5. Variable pay/bonus letters: same pipeline, `type: bonus`, prompting a one-tap "expected vs received" check when the credit lands.

Offer/appraisal letters parse to *future* salary records → cash-flow forecast uses them from the effective date. **Rejected idea**: auto-detecting salary purely from bank credits without payslips — fine as a *trigger* ("this looks like salary — upload the payslip?") but the component breakdown (the actual value: PF/tax/HRA) only exists in the document.

---

## Automation 3 — Investment automation

Strategy: **statements over APIs, APIs over scraping, never scraping.** India's blessing is that consolidated statements are standardized:

| Asset | Feed | Mechanism |
| --- | --- | --- |
| Mutual funds | **CAMS/KFintech CAS** (monthly email, password PDF) | Client-side parser (format is stable and community-documented). One import = every folio, every transaction, every AMC — units, NAV, dates. This *single feature* makes MF tracking fully automatic incl. external SIPs. Detects: purchases, redemptions (→ sell legs + realized gains), dividends, switches. |
| Stocks/demat | **NSDL/CDSL CAS** (monthly) + broker tradebook CSV (Zerodha/Groww exports) | CAS = positions truth; tradebook = transaction truth incl. buy/sell price → lots. Corporate actions (splits/bonus) surface as unit deltas CAS-side; reconcile prompts "1:1 bonus detected — confirm". |
| EPF | EPFO passbook (PDF/portal download) | Parser → contribution + interest rows. Also auto-projected monthly from the last payslip's PF figure (marked *estimated* until passbook confirms). |
| PPF/FD/RD | Bank statement side-effect | NACH/`FD BOOKED`/interest narrations auto-create/feed a **term-deposit account type** (new): principal, rate, maturity date → maturity in Upcoming + forecast. |
| NPS | CRA statement (NSDL) parser; payslip-driven estimates between statements | |
| Crypto | Exchange CSV import (client-side); prices already live | Avoid exchange API keys — withdrawal-scope risk not worth it. |
| Gold/SGB | Manual qty (rare events) + live price ✅ | SGB: bond entity with interest schedule + maturity. |
| ESOPs/RSUs | **Vesting-schedule entity** (grant, cliff, cadence, FMV source) → auto-creates vest events (income at FMV — a tax event! — + holding units) in Upcoming and drafts | Manual FMV for private cos; ticker for listed. |
| Real estate | Manual valuation with staleness nudge (annual "revalue?" prompt); optional index-linked estimate clearly labeled *estimate* | Rejected: scraping property portals — noise, not signal. |
| Bank balances | Statement imports keep them true; closing-balance line cross-checks the derived balance ✅ (existing engine) | |

**Estimated-vs-confirmed is the key mechanism**: between documents, the system *projects* (SIP schedules, PF from payslips, FD interest accrual) and marks rows `estimated`; document import *reconciles* estimates into confirmed rows (same dedup engine). The portfolio is never stale *and* never silently wrong — staleness is visible per-holding ("EPF: confirmed till Mar, estimated since").

**Account Aggregator (the endgame)**: RBI's AA framework provides consented, read-only bank/MF/insurance data via TSPs (Setu/Finvu). It obsoletes statement upload — but requires a registered legal entity, a real backend, and a compliance posture. Verdict: design the ingestion layer so AA is *just another adapter* (same normalizer/dedup/inbox), decide on AA itself only if/when the product becomes multi-user SaaS (Year 3+, see [09-long-term-roadmap.md](09-long-term-roadmap.md)). Do not contort the Year-1 architecture for it; do keep the adapter seam clean.

---

## Automation 4 — Bills, subscriptions & recurring detection

Flip the current model: today the user *declares* recurrence; the system should **mine** it.

- **Recurrence miner** (pure domain function over the ledger — fits `lib/domain/` perfectly): group transactions by resolved brand/normalized-merchant + account; fit period candidates (weekly/monthly/quarterly/yearly, ±3-day jitter) over ≥3 occurrences; score by amount stability (exact = subscription; ±20% = utility bill; fixed + NACH narration = EMI/SIP/premium). Output: "Found 7 recurring payments" inbox digest → one tap converts each to a Subscription/Recurring/EMI with history back-linked.
- **Change detection**: next occurrence deviates (amount ↑, missed, duplicate charge) → inbox alert. Netflix price hikes become a push notification, which is worth more than the tracking itself.
- **Mandate awareness**: NACH/UPI-Autopay narrations flag rows as mandated; a "Mandates" view lists every standing instruction the bank statements have ever shown — most users don't know this list themselves.
- **Cash-flow prediction**: project 90 days of balance per account from confirmed schedules + mined recurrences + salary records; alert on projected dips below minimum balance ("HDFC will go below ₹10k on the 4th — rent + insurance collide"). V1 is deterministic and buildable on the existing `upcoming.ts` feed.

---

## Automation 5 — AI-assisted capture (the moment of spend)

Priority order by real-world frequency for this persona:

1. **PWA share-target + paste** (the unlock; manifest change + inbox): share a GPay/PhonePe payment screenshot, bank SMS text, or WhatsApp forward *to Ledger* → parsed draft (screenshots via lightweight OCR client-side; SMS text via the narration decoder — same grammar as statements). Android share-sheet is the "capture at the moment of payment" UX that Bluecoins/Walnut proved; a PWA can have it via `share_target`.
2. **Receipt photo** (`components/receipt/` placeholder): camera → client-side OCR → amount/merchant/date/line-items draft; receipt archived to vault linked from the transaction. Line-item capture enables warranty search and itemized splitting later.
3. **NL text, upgraded**: current parser handles `lunch 450`; extend grammar to accounts/dates/spaces (`450 swiggy hdfc cc yesterday #goa`) deterministically; BYOK LLM fallback for free-form ("split 2400 dinner with Adi and S, I paid").
4. **Voice** = Web Speech API → same NL pipeline. Cheap once (3) exists; don't build a "voice assistant".
5. **Email-forward** → Automation 6.

All capture routes converge on the same draft/inbox/dedup spine — an SMS-captured expense later auto-merges with its statement row (the ref-number short-circuit), so capture-now never creates cleanup-later.

---

## Automation 6 — Email ingestion

Two architectures, honestly compared:

| | **A. Forwarding alias** (recommended) | B. Mailbox OAuth (Gmail API read-only) |
| --- | --- | --- |
| Mechanism | Per-user address (`u-abc123@in.ledgerapp.dev`) via **Cloudflare Email Workers** — fits the existing worker estate; parse → encrypted draft blob → client pulls, decrypts, deletes | Server or client polls full inbox with query filters |
| Privacy | User explicitly forwards (or sets *their own* Gmail filter to auto-forward CAS/card-bill senders — user-controlled selectivity) | Standing access to *all* mail; catastrophic scope; Google security review burden |
| Trust required | Only for mails the user chose to send | Total |
| Effort | S–M (worker + parsers exist) | L + ongoing compliance |
| Verdict | ✅ Build. E2E-encrypt drafts with a client key; retain ≤7 days | ❌ Reject. Violates the privacy identity; "auto-forward filters" give 80% of the value with user-held control |

High-value senders to parse (stable templates): CAMS/KFintech CAS, NSDL/CDSL CAS, credit-card statement mails (HDFC/ICICI/Axis/Amex), mutual-fund transaction confirmations, dividend advices, insurance renewal notices, flight/hotel bookings (→ trip Space suggestion), broker contract notes. Password-protected attachments: forwarded encrypted, opened client-side with per-sender stored passwords.

---

## Automation 7 — Calendar & temporal automation

- **Derive, don't ask**: the Upcoming feed already merges recurring/subscriptions/SIPs/CC-due. Add: EMI schedules, FD/RD/SGB/insurance maturities and renewals, ESOP vests, goal deadlines, **the Indian tax calendar** (advance-tax quarterlies Jun 15/Sep 15/Dec 15/Mar 15, ITR deadline Jul 31, tax-saving cutoff Mar 31) auto-instantiated per FY, document-expiry reminders from the vault (passport/license — user-entered once).
- **ICS subscribe feed**: read-only calendar URL (worker-served, token-guarded, event titles configurable to be discreet: "Ledger: payment due") so everything appears in Google/Apple Calendar. Cheap, huge perceived value.
- **Lead-time policies per event class** (fixes the current due-date-only reminder): bills D-3, insurance D-15/D-3, tax D-30/D-7, maturities D-30. All still data-less pushes (existing privacy design) — the dates array just gets richer.
- **Review rituals as first-class events**: monthly review nudge (1st), quarterly portfolio check, annual planning (April, FY start) — each deep-links to the corresponding review surface, which is what makes the annual retention moments (pain point analysis) actually fire.

---

## What deliberately stays manual

Cash spending (share-target makes it 5 seconds; ATM withdrawals auto-create the Cash transfer), real-estate valuations (annual nudge), goal/target setting, and **every final confirm**. The product promise is not "zero touch" — it's **"zero typing, one glance, full trust."** A weekly 3-minute inbox triage replacing 30+ minutes of entry is the honest, achievable contract — and the inbox digest ("12 drafts, 2 need review, statement matched to ₹0 difference") *is* the product.
