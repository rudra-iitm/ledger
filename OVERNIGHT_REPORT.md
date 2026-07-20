# Overnight Sprint — Ledger as an Agentic Finance OS

**Date:** 20 July 2026
**Baseline:** `84cca74` · **Head:** `c7fa8c5` · 4 commits, 21 files, +2017 / −627

---

## 1. Executive summary

Ledger's problem was not that it lacked AI. It had a well-built provider-agnostic
AI layer, a tool-calling copilot, document extraction, insights and a learning
categoriser. The problem was that **all of it was behind a button**.

The user had to know the feature existed, navigate to it, and press something
labelled "Brief me on today" or "Ask AI" or "Categorize 12 with AI". That is the
product asking the user to ask it to do its job. It also meant the intelligence
only ran when someone remembered it, which is to say: rarely.

The core change is architectural, not cosmetic. There is now a **background agent
runtime** (`lib/ai/agent/`) that watches the ledger and publishes **signals** —
ranked, dismissable, evidence-backed statements that appear where they matter and
disappear when they stop being true. Nothing to prompt. No AI screen. No chatbot.

The design commitment that makes this safe to ship is a **two-layer split**:

| | Computed layer | Model layer |
|---|---|---|
| Cost | Free | User's own Gemini quota |
| Needs a key | No | Yes |
| Works offline | Yes | No |
| Produces | Overdrafts, budget breaches, double charges, price hikes, renewals, untracked subscriptions | Categorisation, learned rules, daily brief, weekly insight scan |
| Numbers authored by | `lib/domain` | `lib/domain` (the model ranks and phrases; it never counts) |

The model layer is an **enhancement to** the computed layer, never a dependency of
it. Delete the API key and Ledger still tells you the balance goes negative on the
14th — it just says it in our words instead of the model's. This was verified in a
live browser, not asserted (§5).

---

## 2. AI pipelines and automation implemented

### 2.1 The agent runtime — `lib/ai/agent/`

| Module | Responsibility |
|---|---|
| `types.ts` | The `Signal` model and `rankSignals` — severity dominates, nearness breaks ties, id breaks the rest so the feed is stable across renders |
| `signals.ts` | Six computed signal builders. Pure, synchronous, no network, no key |
| `jobs.ts` | Three autonomous jobs; each declares its cost, interval, relevance and an input fingerprint |
| `runtime.ts` | The scheduler. `dueNow()` is pure and tested |
| `run-ledger.ts` | Device-local run bookkeeping — never synced, never in a backup |
| `dismissals.ts` | Device-local signal dismissals |
| `components/agent/agent-provider.tsx` | The **only** place the agent meets React or the store |

Layering held: jobs declare intent through an `AgentActions` interface and the
provider performs it. `lib/ai/agent` imports no Zustand, so the whole policy
surface is testable without a renderer, a clock or a network.

### 2.2 Autonomous jobs

**Auto-categorisation** (cost 1, min 5 min) — imported rows the brand registry,
narration grammar and user rules all failed to place get a category *before the
user ever opens the Inbox*. Writes to drafts only; confirming stays a human act.

**The learning loop, closed** — a merchant the model placed the same way twice,
both times high-confidence, now **becomes a rule automatically**. Previously this
was a toast offering to create one: the app knew the answer and asked the user to
press a button to write it down. Rules remain inspectable, editable and exportable
on the Rules screen, so nothing is learned that can't be seen and undone. The
payoff compounds — every rule written here is a merchant that never needs a model
call again.

**Daily brief** (cost 1, min 12 h) — replaces the "Brief me on today" button.

**Weekly insight scan** (cost 1, min 7 days) — only `high` confidence findings are
promoted to signals. A hedged observation doesn't earn a slot on the home screen.

### 2.3 Computed signals (zero API cost)

Cash-flow overdraft (critical, **undismissable** — money running out is not
something the user gets to hide from) · thin-month warning · over-budget ·
worst over-budget category · anomalies · renewals within 3 days · **untracked
recurring charges** · inbox backlog.

The recurring detector is new to the surface: `mineRecurring` already existed but
was buried on the Inbox screen, which a user only opens after an import. Promoting
it is the difference between a feature that exists and one that fires.

### 2.4 Spend discipline

Autonomous AI spends someone else's money, so the guards are hard, not advisory:

- **6 model calls/day ceiling.** At the cap the agent stops until local midnight.
- **Charged before the call** — a call that fails after leaving the device has
  still been billed by Google.
- **Input fingerprinting.** Unchanged inputs never spend, however old the run.
- **Exponential backoff** — 5 m → 6 h. A revoked key costs a handful of calls,
  not one per page load forever.
- **Serial and idle-scheduled.** Never parallel (rate limits), never blocking.
- **Silent failure.** The user didn't ask for the run, so they don't get an error.

---

## 3. UI/UX

**Deleted:** the `/copilot` page and view (a chat screen in a finance app),
`ai-briefing.tsx`, the Inbox's "Categorize N with AI" button, search's
"Ask AI: <query>" row, the rule-suggestion toast, and the Copilot/Insights/Scan
entries cluttering the account menu.

**Search** now resolves itself: the deterministic grammar tries first, and when it
finds no structure the model compiles the question on a 600 ms debounce, rendering
the **same** "Show expenses: …" row the grammar produces. One kind of answer, not
two. The user never learns the word "fallback".

**The dashboard** lost a 10-tile shortcut grid (a menu pretending to be a
dashboard) — now 4. The standalone budget-alert cards and forecast card were
folded into the feed that supersedes them.

**The signal feed** is built on restraint: max 3 visible, no robot iconography, no
"generated by" labels, no sparkles, no skeletons. Every signal carries a **Show the
numbers** disclosure so the user can check our work.

**The off switch.** Settings now lists every job the agent may run (generated from
`AGENT_JOBS`, so a new job cannot avoid appearing), what it has spent today, and
one switch to stop it. Without this the agent is spyware with good intentions.

---

## 4. Architecture and performance

- `settings.autonomy` (`"off" | "ambient"`), defaulted via Zod so every existing
  settings file keeps parsing — no migration needed.
- Home route JS: **4.57 kB → 3.21 kB (−30 %)**. Shared First Load: 323 → 325 kB
  (+2 kB, the provider now living in the shell). Measured by building `84cca74`
  in a scratch worktree, not estimated.
- Dead code removed: `computedHeadline` — I wrote it, never wired it, deleted it.
  Tested dead code is still dead code.

---

## 5. Verification

```
typecheck   tsc --noEmit            clean
lint        eslint                  clean, 0 warnings
tests       vitest run              193 passed / 193 (was 160) — 33 new
build       next build              compiled, 35/35 static pages exported
```

Every commit was verified before landing; no commit in this range is red.

**Live browser verification** (dev server, `mcp__Claude_Browser`) — the useful
part, because it exercised the failure path for real:

1. Dashboard rendered the feed with zero console errors.
2. **Show the numbers** disclosed the evidence line.
3. Dismiss removed the signal, persisted to `ledger:agent-dismissed`, and survived
   a reload; the feed correctly rendered *nothing* rather than an empty state.
4. The agent ran on idle and the run ledger recorded:
   `{"spentToday":1,"jobs":{"agent.brief":{"failures":1,...}}}`

Point 4 is the valuable one. The Gemini key supplied for this sprint
(`AQ.Ab8RN6It…`) is an OAuth-style token, not an `AIza…` API key, so the call
failed — and the failure behaved exactly as designed: **one** charged call, a
recorded failure, a 5-minute backoff, **no error surfaced to the user**, and the
computed signal layer still rendering the feed on its own. The degradation story
is not a claim in this document; it is what the app actually did.

A test bug was also caught by `tsc` mid-sprint: a fingerprint case was passing
`InboxData` where `LedgerData` was expected, so both sides fell back to
`EMPTY_DATA` and the assertion compared two identical empty hashes. It passed
while testing nothing. Fixed and now meaningful.

---

## 6. What I did not do, and why

Reporting this honestly matters more than a longer list of claims.

**Framer Motion — deliberately not added.** The brief asked for it. I recommend
against it here: the app already has purposeful micro-interactions via Tailwind's
`ease-spring`, `active:scale-*` and transition utilities, running on the compositor.
Adding ~50 kB gzipped of animation runtime to a mobile-first PWA to reproduce what
CSS already does would be a net regression for an offline-first app on Indian
mobile networks. I'd rather be told I was wrong than ship the bloat silently.

**Phase 3 (wealth/investments overhaul) — not started.** Investments, holdings,
SIPs, goals and live prices already exist; the ask was an intelligence layer over
them (projected net worth, rebalancing, risk). That is a genuine feature surface
deserving its own design pass, and starting it at 3 a.m. would have produced a
half-built screen rather than a finished one. The agent runtime is the right
foundation for it: it is a new job plus new signal kinds, not a new architecture.

**The `/insights` and `/scan` screens still exist.** Both are now reachable only
from context rather than the main menu. Scanning a document is inherently
user-initiated (you pick the file), so it is not a gimmick surface.

---

## 7. Recommended next steps

1. **Replace the Gemini key** with an `AIza…` key from
   [Google AI Studio](https://aistudio.google.com/apikey) — the model layer cannot
   run until then, though everything else works.
2. **Phase 3** as agent jobs: a `wealth.review` job producing projected-net-worth
   and allocation-drift signals.
3. **Push the brief to the lock screen** — the reminders infrastructure
   (data-less Web Push) already exists.
4. Consider promoting `autonomy` to a three-state setting if the 6-call ceiling
   proves too tight in daily use.
