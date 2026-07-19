# 16 — Product Vision (Inferred)

## What kind of app is this?

A **premium, private, single-user personal-finance command center for a tech-savvy Indian user** — closer to "Linear/Raycast for your money" than to Mint or Walnut. The README says it outright ("minimal, premium… inspired by the ChatGPT iOS app, Linear, and Raycast") and the code agrees: dark-only, iOS-native affordances, bottom sheets everywhere, tabular-nums typography, spring easing, no onboarding funnel, no telemetry, no ads, no server to trust.

## Target user (high confidence)

The author themself, and people like them: an Indian software engineer who
- lives on GitHub (the *database* is a GitHub repo; PAT sign-in is a first-class path),
- pays with UPI (UPI-prefix stripping in merchant matching), orders on swiggy/zomato, rides ola/uber/rapido,
- invests in mutual funds via SIP (AMFI NAV codes), stocks (`.NS` tickers), gold, crypto,
- splits bills with friends (Splitwise-style groups) and lends money informally (LendBorrow),
- wants data ownership and privacy as a feature (private repo, data-less push, no analytics SDK).

Evidence of single-user intent: one hardcoded data repo name, sessions with no concept of profiles, groups' `selfMemberId` is "which member is me".

## Problems it solves

1. **Fast capture** — quick-add NL parsing, center-`+` action sheet, mobile-first: minimize friction from "spent money" to "recorded".
2. **One truthful ledger** — derived balances, double-entry rows, hard-reset escape hatch: the app's number should match reality, and reconcile/adjust exist for when it doesn't.
3. **The Indian finance shape** — CC statement cycles, SIPs, gold grams, lakh/crore formatting, IFSC metadata, bill splitting with friends.
4. **Ownership without ops** — no database to run, no subscription to pay; GitHub Pages + a free-tier Worker.

## Core differentiators

- **GitHub-as-DB** with git history as an audit log/backup — genuinely unusual.
- **Privacy-first push** (server never sees amounts) — a deliberate design worth marketing.
- **Everything is one Expense row** — a small, learnable data model powering budgets, spaces, analytics, CC statements, and portfolios simultaneously.
- Design quality far above typical side-project finance apps.

## Where the vision is incomplete (from the code itself)

- **Multi-device and multi-user are aspirational**: LWW file writes, add-only group merges, and Google-login-as-local-mode show sync ambitions ahead of the sync substrate.
- **Capture automation is the visible next frontier**: empty `app/inbox/` + `components/receipt/` directories, the brand registry's UPI machinery, and the quick-add parser all point toward "get transactions in without typing."
- **Liabilities are half-modeled**: credit cards yes; loans/EMIs no.
- The README's aspirational claims (tests, RHF, TanStack Table) suggest a quality bar the codebase hasn't caught up to yet.

## Likely intended trajectory (inference, medium confidence)

1. Inbox + receipt/SMS-paste capture (the empty dirs).
2. Sturdier sync (the current design's sharpest edge for a user with a phone + laptop).
3. Deeper investment features (sell legs, net-worth history — the portfolio UI is already the most elaborate screen).
4. Polish the shared-groups story toward "Splitwise replacement for my friend group".
