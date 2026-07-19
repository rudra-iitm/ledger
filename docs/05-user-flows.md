# 05 — User Flows

All flows verified against source. There is no separate onboarding — first launch lands on `/login`; there are no admin flows (single-user app).

## Authentication & first data

```mermaid
flowchart TD
  A[Open app] --> B{AuthGate: store status}
  B -- unauthenticated --> C[/login/]
  B -- loading --> S[Skeleton shell]
  B -- ready --> H[/ Dashboard/]
  C --> D{Provider}
  D -- GitHub OAuth --> E[startGitHubLogin: state→sessionStorage, scope=repo]
  E --> F[/auth/callback?code&state/]
  F --> G[Worker POST / → access_token → /user profile → signIn]
  D -- GitHub PAT --> T[Token sheet → validate via /user → signIn]
  D -- Google --> GG[GIS token client → userinfo → signIn - identity only, data stays local]
  D -- This device --> L[signIn provider:local]
  G & T & GG & L --> H
  H --> Q[QuickAddInput 'lunch 450'] --> R[addExpense → recent list]
```

GitHub mode: on first load the adapter creates a **private `ledger-data` repo** (`auto_init`) if missing, then reads `data/*.json` (11 files in parallel).

## Adding an expense

```mermaid
flowchart TD
  subgraph QuickAdd
    QA[Dashboard / ActionSheet input] --> QP[parseQuickAdd: amount + description + inferCategory]
    QP --> QS[addExpense date=today, no account] --> QT[toast]
  end
  subgraph FullSheet
    P[Tab-bar +] --> AS[ActionSheet] --> ES[ExpenseSheet]
    CAL[Calendar day → Add expense] -- defaults.date --> ES
    SP[Space detail → Add] -- defaults.spaceId --> ES
    ES --> V{description & amount>0?}
    V -- no --> ERR[inline error]
    V -- yes --> SAVE[addExpense → upload pending attachments ≤50MB]
    SAVE --> CLOSE[toast + close + balances recomputed]
  end
  ROW[ExpenseRow tap / swipe → Edit] --> ES2[edit: save / delete / view field history]
```

Editing/deleting: `updateExpense` appends `{at, field, from, to}` history entries; `deleteExpense` also removes attachments and garbage-collects an investment account left with no transactions.

## Adding an account

```mermaid
flowchart TD
  A[/accounts/ or Settings] --> B[New → AccountSheet]
  B --> C[name · type · opening balance · as-of date]
  C --> D{type}
  D -- bank --> E[holder, account no, IFSC, branch, variant, min balance]
  D -- credit_card --> F[limit, statement balance, min due, due date]
  D -- investment --> G[assetType + priceId if needed]
  E & F & G --> H[addAccount → card appears]
  H --> I[/account?id= — Adjust · Reconcile · Edit/]
```

## Credit-card payment

```mermaid
sequenceDiagram
  actor U as User
  participant AD as AccountDetailView (CC)
  participant CS as CCPaymentSheet
  participant ST as app-store
  U->>AD: open /account?id=card
  AD-->>U: Outstanding, statement due, utilization, status chip
  U->>AD: Pay bill (disabled if outstanding ≤ 0)
  AD->>CS: openCreditCardPayment(cardId)
  U->>CS: amount (chips: statement / minimum / full), Pay from, date
  CS->>CS: validate amount>0, payer ≠ card
  CS->>ST: addCreditCardPayment (type=cc_payment row)
  ST-->>AD: card balance ↓ (sign flip), payment history row, status updates
```

## Group: create → split → settle

```mermaid
flowchart TD
  A[/groups/] --> B[GroupSheet: name + ≥2 members] --> C[/group?id=/]
  C --> D[Add expense → GroupExpenseSheet]
  D --> E{Split type}
  E -- Equal --> F[splitEqually: paise floor + first-r get +1p]
  E -- Unequal --> G[per-member amounts must sum to total]
  E -- Percent --> H[must sum to 100 ±0.01]
  F & G & H --> I[addGroupExpense]
  I --> J[computeBalances → optimizeSettlements]
  J --> K[Settle-up rows 'A → B ₹x']
  K --> L[Mark paid → prefilled payment dialog] --> M[recordGroupSettlement]
  M --> N[balances re-zero; payments history]
```

## Sharing a group / joining via link or QR

```mermaid
sequenceDiagram
  actor Friend
  participant O as Owner (GroupDetailView)
  participant W as Worker (GROUPS KV)
  participant J as JoinGroupView
  O->>W: Invite → shareGroup: POST /groups → remoteId (uuid), rev 1
  O-->>Friend: QR / link /groups/join?code=remoteId
  Friend->>J: open link
  J->>W: GET /groups/:code (preview: name, members, expense count)
  alt already joined locally
    J-->>Friend: "Open group"
  else new member
    Friend->>J: display name → joinGroup → POST /groups/:id/join
    J-->>Friend: redirect /group?id=local · "Synced" badge
  end
  loop every 15s + window focus (while detail open)
    O->>W: GET group → mergeSharedIntoLocal (union-by-id, local wins)
    O->>W: PUT with expectedRev on local extras (409 → merge + retry once)
  end
```

Caveat: the union merge has no tombstones — deletions resurrect, and edits to an existing item never propagate (see [09-state-management.md](09-state-management.md)).

## Investment + SIP

```mermaid
flowchart TD
  A[/investments/] --> B[Invest → InvestmentSheet]
  B --> C{Asset}
  C -- existing --> D[pick holding]
  C -- new --> E[type + name + optional priceId → addAccount type=investment]
  D & E --> F[amount · units · Paid from · affectsBalance · date]
  F --> G[addInvestment → row posts −source +holding; units add]
  A --> H[Recurring → RecurringInvestmentSheet: asset, amount, frequency incl. quarterly, day, start]
  H --> I[auto-materializes investment rows when due]
  A --> J[Refresh prices → Worker /prices → gain/loss updates]
```

## Lend / borrow

```mermaid
flowchart TD
  A[Avatar menu → /lend-borrow/] --> B[+ → /lend-borrow/new/]
  B --> C[lent|borrowed · amount · person · description · date · due? · account tracking-only · attachments]
  C --> D[addLendBorrow → list with status chip]
  D --> E[/lend-borrow/detail?id=/]
  E --> F[Record Repayment ≤ outstanding · Settle Full shortcut]
  F --> G{outstanding ≤ 0?}
  G -- yes --> H[Fully Settled banner]
  E --> I[History → /lend-borrow/person/detail?name= net position]
  E --> J[Delete via native confirm]
```

## Backup / restore

```mermaid
flowchart TD
  A[/settings/ → Data] --> B[Export backup → JSON download - no tokens, no attachment blobs]
  A --> C[Import backup → file picker]
  C --> D{window.confirm full replace?}
  D -- no --> A
  D -- yes --> E[parseBackup: per-file migrate + Zod validate]
  E -- ok --> F[replace ALL 11 collections → recompute → persist 11 files]
  E -- BackupParseError --> G[specific error toast]
```

## Reminders (push)

```mermaid
sequenceDiagram
  participant U as User (Settings)
  participant R as reminders.ts
  participant W as Worker (PUSH KV)
  participant SW as Service worker
  U->>R: enable toggle
  R->>R: Notification.requestPermission + pushManager.subscribe(VAPID)
  R->>W: POST /push/subscribe {subscription, dates[]}
  Note over R,SW: PwaManager rewrites the local reminders cache +<br/>re-POSTs dates whenever recurring/subs/SIPs/accounts change
  W-->>SW: daily 09:00 UTC cron → data-less push if today ∈ dates
  SW->>SW: read cached events, filter local-today, compose notification
  SW-->>U: notification → click opens /calendar/
```

## Sign-out

`signOut` clears the session key and store state but does **not** revoke the GitHub token, purge `ledger:data:*` localStorage, or clear IndexedDB attachments — on a shared machine, local-mode data survives into the next session.
