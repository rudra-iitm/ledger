# 02 — User Pain Points: The Five-Year Simulation

Method: simulate a committed power user (Indian engineer, salary + SIPs + credit cards + friends + eventually spouse/kids) using today's Ledger daily for five years, and log every moment they'd sigh, cheat, or quit. UX-researcher + finance-expert lens. Ordered by **churn risk**.

## Tier 1 — Will make users quit

### 1. Manual entry fatigue (months 1–6)
Every UPI tap, card swipe, and auto-debit must be typed. A typical urban Indian user has **60–120 transactions/month**; even at 15 seconds each that's ~30 min/month of pure data entry — and the real cost is *remembering*. The moment a week goes unlogged, the ledger diverges from reality, reconcile shows a mystery gap, and the "adjust balance" hard-reset becomes a monthly ritual of giving up on history. **Every manual-tracker's death spiral is: skip → drift → distrust → abandon.** Ledger has the drift-repair tools (reconcile/adjust) but no drift-prevention (import).

### 2. The second device (month ~2)
Phone + laptop is table stakes for this persona. Today: laptop edit + phone edit = one silently vanishes (whole-file LWW). Worse, opening the PWA in a lift/flight **logs you out**. Users don't file bug reports for lost financial data — they stop trusting the numbers, and trust is the product.

### 3. Investment truth decay (months 3–12)
Prices auto-refresh ✅, but *positions* don't: every SIP execution outside the app's own schedules, every dividend, every EPF monthly credit, every FD interest posting must be typed. Nobody backfills 12 months of EPF. By year 2 the portfolio screen shows a number the user knows is wrong — worse than no number.

### 4. Tax season (every February–July)
Five years of data and the app can answer *nothing* the CA asks: realized LTCG/STCG per FY (no sell legs), 80C proof list, TDS vs Form 16, interest income across FDs/savings, rent receipts for HRA. The user maintains a parallel spreadsheet + folder — the app failed at the highest-stakes annual moment of personal finance.

## Tier 2 — Chronic friction (tolerated, resented)

### 5. Categorization is static
The keyword table doesn't learn. Corrections are Sisyphean: recategorize "Blinkit" to Food 40 times and the 41st is still wrong (no rules engine, no learning-from-corrections). Fixed 9 categories force everything interesting into tags, and tags have no analytics.

### 6. Reconciliation without a statement
Reconcile compares app-balance to a number you read off your bank app — it tells you *that* you drifted, never *which transactions* are missing. Guided statement-match is the actual job.

### 7. Salary evolution
Appraisal, bonus, RSU vest, employer switch: today that's "edit the recurring income amount" — history is overwritten in place, PF contributions untracked, no income timeline. Five years in, "when was my highest salary?" is unanswerable.

### 8. Finding old records
"That AC invoice from 2027 for warranty" / "insurance policy PDF" — attachments are buried inside individual transactions; there's no vault, no document search, no filing by type/year.

### 9. Group half-life
Trip groups work great for a weekend, then: can't rename, can't remove the friend who dropped out, deletions resurrect on sync, expenses can't be back-dated or edited. Real Splitwise migration dies on these edges within one trip.

### 10. Subscription entropy
Detection is manual — the user must *notice* a subscription to add it. Price hikes (Netflix's annual ritual) silently break the recorded amount; annual renewals surprise; the renewal-date drift bug compounds. The app should be *telling the user* about recurring charges, not vice versa.

### 11. Click-depth for the top action
Fast path exists (quick-add ✅) but only for today-dated, account-less expenses; assigning account/space/tags reopens the full sheet. The most common real entry ("₹340 Swiggy from HDFC CC, yesterday") takes ~8 taps.

## Tier 3 — Emerges with life changes

### 12. Marriage / family (year 2–4)
Two people, joint account, shared rent, separate personal spending: the model has no household. Sharing options today are all-or-nothing (share the GitHub repo = share *everything*, incl. what you spent on their gift). Kids add education goals, fee schedules, custodial investments — none modeled.

### 13. Wealth complexity (year 3–5)
Real estate, ESOPs/RSUs (vesting schedules, dual tax events), foreign stocks (multi-currency — currently cosmetic), unlisted investments, multiple demat accounts. Kubera-class asset breadth is where five-year users land; Ledger's 8 asset types with single-currency ₹ won't hold them.

### 14. The annual questions
"Am I on track to retire?" "Can I afford the house?" "What's my FI number?" — the app has five years of perfect data and no projection engine to spend it on. This is the moment the user pays for Empower/a CFP and Ledger becomes the CFP's *input*, not the OS.

### 15. Mortality & continuity (the decade question)
Everything lives behind one person's GitHub account and memory. No nominee registry, no emergency-access ("if I'm gone, my spouse needs this"), no will/estate documents. A finance OS that vanishes with its user isn't an OS.

## Cross-cutting observations

- **The 80/20 of pain is ingestion** (points 1, 3, 5, 6, 10 are all "the app doesn't know what happened"). Fix ingestion and reconcile/categorize/subscriptions/investments all soften simultaneously.
- **Trust failures compound differently than friction**: friction (Tier 2) is churned *slowly*; data loss (point 2) churns *instantly and silently*. Sync trust must precede automation, or imports will amplify the data-loss blast radius.
- **The annual moments (tax, review, planning) are the retention weapons** — monthly habit apps die when the habit breaks; annual-value apps get re-adopted every February. Ledger has monthly review but nothing annual.
- Pain points 1–3 map exactly to the empty `app/inbox/` + `components/receipt/` placeholders — the author already knows.
