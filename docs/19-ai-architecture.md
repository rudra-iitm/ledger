# 19 — AI Architecture

How the AI layer is built, why it's built this way, and what you need to know
to add a feature to it.

## The one rule

**Deterministic engines compute. AI narrates, extracts, and prioritises.**

A model in this app never produces a number that ends up in front of the user.
It picks *which* question to ask and *how* to phrase the answer; `lib/domain`
does the arithmetic. Three things fall out of that:

- every answer reduces to a query the user can open and check row by row;
- the question and a schema go over the wire, not five years of transactions;
- the same question gives the same numbers twice.

The failure mode this avoids is the one that makes AI finance tools untrustworthy:
a confident, plausible, wrong total. If you are adding a feature and find
yourself asking a model to add things up, stop — write the domain function.

## Layers

```
components/            ← screens; know nothing about models or HTTP
  signal-feed, autonomy-card, insights-view, scan-view, ai-activity-log
        │
components/agent/agent-provider.tsx
        │              ← the ONLY place the agent meets React or the store.
        │                Jobs declare intent (AgentActions); this performs it.
lib/ai/agent/          ← the background runtime: signals, jobs, scheduler
        │                computed signals need no model and no key at all
lib/ai/features/       ← one module per capability
  advisor · documents · categorize
        │
lib/ai/client.ts       ← THE ONLY DOOR. spend guards, cache, retry,
        │                validation, telemetry
lib/ai/gemini.ts       ← transport: HTTP + Gemini's JSON dialect, nothing else
        │
lib/domain/            ← pure. no React, no IO, `now` injected
  query.ts · health.ts · forecast.ts · anomalies.ts · …
```

A feature that reaches past `client.ts` into a provider is a bug — every
policy below would silently stop applying to it.

### `provider.ts` — the contract

Messages, parts, tools, structured output, typed errors. Swapping Gemini for
another provider (or adding a local WebGPU model for the privacy-maximalist
path in [04-ai-features.md](product-analysis/04-ai-features.md)) means writing
one object that satisfies `AiProvider`. No feature changes.

### `models.ts` — capability tiers, not model names

Features ask for `fast`, `balanced`, `deep` or `vision`. Each tier is an
ordered **chain**, not one id:

| Tier | For | Leads with |
|---|---|---|
| `fast` | categorization, query compilation | `gemini-flash-lite-latest` |
| `balanced` | insights, narration, daily brief | `gemini-flash-latest` |
| `deep` | health plans, goals, tax | `gemini-pro-latest` |
| `vision` | receipts, invoices, payslips | `gemini-flash-latest` |

The `-latest` aliases lead deliberately. Pinned ids rot, and this app is
bring-your-own-key — a model Google retires *for new accounts* breaks AI for
exactly the people who just signed up. That happened here with
`gemini-2.5-flash`. Pinned ids sit behind the alias as the safety net for the
day an alias is what disappears. A model that 404s walks down the chain, and
the winner is remembered so steady-state traffic never pays for the probe.

### `gemini.ts` — transport, with two resilience behaviours

Only the transport can see the conditions that trigger these, so they live here
rather than in `client.ts`:

- **Model fallback** — walk the tier chain on a missing model.
- **Body degradation** — a request rejected for an unsupported generation field
  is retried without it. Four levels: full → drop `thinkingConfig` → drop
  `responseSchema` → drop `responseMimeType`. A model that doesn't understand
  one of our knobs still answers instead of 400-ing the feature away.

One non-obvious fact, pinned by a test: **Gemini answers a bad API key with
400, not 401/403.** Classifying that as a generic error hides the only action
that fixes it.

### `client.ts` — the one door

Ordering is deliberate: cache → spend guards → network, so a cached answer
costs neither a token in the bucket nor a millisecond of latency.

- **Cache** (`cache.ts`) — content-hashed on the full request including the
  prompt *version*, so editing a prompt invalidates its answers. TTL, then LRU.
- **Rate limits** (`rate-limit.ts`) — token bucket (bursts drip instead of
  tripping Gemini's per-minute limit and failing a whole batch), a concurrency
  gate of 3, and a 400/day ceiling as the runaway-loop backstop.
- **Retry** — exponential backoff with jitter, only for errors marked
  `retryable`. Without the jitter, several features retrying after one
  rate-limit event resynchronise and trip it again.
- **Validation** (`runJson`) — Zod on whatever comes back. On a shape
  violation the model gets exactly one corrective retry *containing the
  validation error*, which is far cheaper and more reliable than raising the
  temperature.
- **Telemetry** (`telemetry.ts`) — written by the transport itself, so there is
  no code path to the network that skips the log. Prompt *content* is
  deliberately not stored; that would make the log a second copy of the ledger.

## Grounding: the query DSL and tools

`lib/domain/query.ts` defines `LedgerQuery` — intent, row kind, time preset,
filters, grouping. A model emits one; `executeQuery` runs it locally. Zod is
strict on vocabulary (an invented category is rejected, not coerced) and
forgiving on absence (a sparse response still runs).

`lib/ai/tools.ts` exposes ten read-only tools over the existing domain
engines — transactions, balances, net worth, forecast, health, budgets,
subscriptions, portfolio, upcoming bills, anomalies. Two rules:

1. **Read-only.** Writes go through the draft/confirm flow.
2. **Compact output.** Results are re-sent with every subsequent turn, so they
   return aggregates and a few examples, never bulk rows.

A tool that throws returns its error *as data* — the model can recover from
"that account id doesn't exist"; an exception kills the turn.

## Prompts

`lib/ai/prompts/` — templates are objects with an id, a version, a tier, and a
pure `render`. `PROMPTS` is the complete list of things this app can ask a
model to do. Data-minimisation is enforced in `render`, so auditing what
leaves the device means reading one file.

Shared `HOUSE_RULES` and `EXPLAIN_RULES` encode failures we actually saw:
models pad with praise, invent plausible totals, and hedge until the answer
carries no information.

## Writing to the ledger

Nothing AI-derived is written directly. A scanned receipt becomes a
`DraftTransaction` in the Inbox through `lib/domain/ingest/document.ts` — the
same gate a statement line goes through — gets the user's rules applied, and
waits for confirmation. `documentLineHash` shares a hash space with statement
lines, so scanning a receipt whose purchase later arrives on a statement
dedupes instead of double-counting.

`lib/domain/ingest/document.ts` exists specifically so the store never imports
from `lib/ai`.

## Learning

Corrections become **rules**, not weights. `categorize.ts` replays the user's
past corrections as few-shot examples, and offers a rule when it classifies a
merchant the same way twice. What the app learns stays inspectable, editable
and exportable. Low confidence is a first-class answer: an unsure guess is left
as "Other" rather than written in.

## Cost and privacy

- The key lives in `localStorage` only — never in synced data or backups.
- Calls go browser → Gemini directly. There is no server; this is a static
  export.
- Every call is listed in Settings → AI → Activity with its feature, model,
  prompt size, latency, attempts and estimated cost.
- Nothing auto-runs on load. The daily brief, insights and health plan are all
  one tap, because spending the user's Gemini quota is not a decision the app
  gets to make for them.

## Adding a feature

1. Compute the facts in `lib/domain` (pure, `now` injected, unit-tested).
2. Add a template in `lib/ai/prompts/templates.ts`.
3. If the output is structured, add a Zod schema *and* a JSON Schema in
   `lib/ai/schemas.ts` — the degradation ladder can drop the latter, so the
   former is what actually protects you.
4. Write the feature in `lib/ai/features/`, calling `runAi` / `runJson` /
   `streamAi`.
5. Surface it with a loading state, an `AiError` toast, and a visible statement
   of what it was based on.

## What is deliberately not built

From [04-ai-features.md](product-analysis/04-ai-features.md), still rejected:

- Chat as the primary interface — chat is a query input; structured surfaces
  win for money.
- AI writing transactions without confirmation.
- Auto-budgets that move targets silently.
- Sentiment/behavioural profiling.
- Fine-tuned models — rules plus prompts cover it at this scale.
