# 15 — Missing Features

Only gaps that naturally extend the existing architecture and vision (single-user, GitHub-backed, India-centric, privacy-first). Each is grounded in something the code already half-does.

## Evidence-backed (the code already points here)

| Missing | Evidence in code |
| --- | --- |
| **Inbox screen** | `app/inbox/` exists as an empty directory — likely a notification/pending-items hub (due bills, near-limit budgets, unsynced changes) |
| **Receipt capture/scanning** | `components/receipt/` empty directory; attachments + 50 MB image support already exist — OCR-to-expense is the natural next step |
| **Debit-card spend tracking** | `Expense.debitCardId` + per-card "today's spending" calc exist; only the sheet-side card picker is missing |
| **Weekly/annual recurrence anchors** | `weekday`/`monthOfYear` schema fields exist but the engine ignores them — "every Friday" / "every April 1" are half-modeled |
| **Multi-currency** | `Account.currency` field + currency picker exist but are cosmetic; real support needs ISO codes + FX at minimum for display |
| **Statement-cycle modeling** | `statementBalance/statementDueDate/minimumDue` exist; a `statementDate` + per-cycle payment windowing would fix the stuck-"Paid" defect and enable statement history |
| **Group editing** | `openGroup(group?)` edit plumbing exists; the sheet just never consumes it |

## Finance-domain gaps (fit the vision, not yet modeled)

- **Loans/EMIs** — credit cards are the only liability type; a loan account (principal, rate, EMI schedule) would slot into the existing liability sign-flip and Upcoming feed. LendBorrow covers informal IOUs only.
- **Selling investments** — units only accumulate; no sell leg, no realized P/L, no capital-gains view. The `type:"investment"` row + `units` field could carry negative units.
- **Income budgets / income-relative savings rate** — savings rate is currently budget-relative; income is tracked but never budgeted against.
- **Net-worth history** — net worth is computed live but never snapshotted; a monthly snapshot file would enable the trend chart the dashboard lacks.
- **Forecasting** — upcoming events exist (45-day horizon) but no cash-flow projection ("balance on the 30th after rent + SIPs").
- **Tax lens** — no 80C/LTCG tagging despite SIP/ELSS-adjacent investment tracking; even a "tax-saving" tag on investments would help the target user.
- **Custom categories** — the 9 expense categories are a fixed enum; users can't add their own (tags are the only escape hatch).
- **Search/filter deep-links** — filters are component-local state; URL-param filters would fix the search dead-end and make views shareable.

## Automation & platform gaps

- **SMS/UPI/email import** — the quick-add parser + brand registry (UPI-prefix stripping!) are clearly built for transaction-text parsing; a paste-SMS importer is a small step, full inbox parsing a larger one. (As a PWA, automatic SMS access isn't possible; paste/share-target is.)
- **PWA share target** — manifest lacks `share_target`; receiving shared screenshots/text into the (planned) inbox fits perfectly.
- **Background sync/outbox** — needed anyway for the P0 offline debt.
- **Multi-device conflict safety** — see [09-state-management.md](09-state-management.md); prerequisite before "sync across devices" can be advertised.
- **Attachment blobs in backups** — restore currently leaves dangling metadata.
- **Reminder lead time & per-item toggles** — reminders fire only on the due date at 09:00 UTC; "remind me 3 days before" is an obvious extension of the same dates array.

## Analytics & reporting gaps

- Spending time-series on Analytics (SpendBars exists but is only used in Space detail).
- Year-in-review (the monthly review engine generalizes).
- Tag-based analytics (tags are captured but never aggregated).
- Report scheduling/email is out of scope (no server) — but a "monthly review push notification" fits the existing data-less push design.

## Explicitly out of scope (would fight the architecture)

Bank-account aggregation (needs a server + AA/Plaid-style integration), real-time collaborative editing (KV + polling can't), and server-side anything beyond the Worker's current four jobs. These would change the product's identity; listed here so they aren't mistaken for oversights.
