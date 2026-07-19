# 10 — UI/UX Inventory

## Navigation model

- **AppShell** (`components/app-shell.tsx`) = AuthGate → SheetProvider → sticky blurred header (title, sync-status dot, search button, avatar dropdown) → `main` (max-w-lg, mobile-first) → floating bottom **TabBar** (rounded pill, 4 icon tabs + center primary `+`): **Home `/` · Calendar · [+] · Analytics · Expenses**. The bar condenses to 82% scale while scrolling.
- **Avatar dropdown**: Spaces, Accounts, Subscriptions, Monthly Review, Lend & Borrow, Groups, Recurring, Reports, Settings, Sign out. (Investments is reachable from the dashboard grid but *not* the dropdown; Lend & Borrow vice-versa.)
- Center `+` → **ActionSheet**: quick-add input + Expense / Income / Transfer / Investment / Recurring.

## Screens (17 views + 4 standalone pages)

| Screen | Route | Highlights |
| --- | --- | --- |
| Dashboard | `/` | Hero month spend, budget progress, quick-add, category-budget alerts, insights strip, 8-shortcut grid, recent 5 |
| Expenses | `/expenses` | Search, time-range picker, account/space/tag filters, sort, category chips, date-grouped infinite scroll (25/page), 3 empty states. Dual-mode: `/investments/transactions` reuses it with asset-type chips |
| Calendar | `/calendar` | Month heatmap (green intensity, today ring, upcoming dots) / Week totals / Day pager; day sheet with add-prefilled-date; Upcoming (8 events) |
| Analytics | `/analytics` | Range+account filters, income-vs-expense tiles, category donut + legend, by-account, CSV/PDF export |
| Accounts | `/accounts` | Total with Include/Exclude Debt, stacked allocation bar, account cards |
| Account detail | `/account?id=` | Adjust/Reconcile/Edit; CC: statement card, utilization, Pay bill, payment history; bank: debit cards, masked metadata; stat tiles; reconciliation history; transactions |
| Investments | `/investments` | Portfolio card, holdings, Refresh prices, transactions preview, SIP schedules, goals |
| Spaces / Space detail | `/spaces`, `/space?id=` | Active/Archived toggle; detail: stat tiles, Overview (donut + SpendBars w/ granularity) / Expenses / Files tabs |
| Groups / Group detail | `/groups`, `/group?id=` | Members, settle-up suggestions with Mark paid, payments, expenses; Invite (QR + link) when sync enabled; 15s polling |
| Join group | `/groups/join?code=` | Preview → display-name form → join |
| Lend & Borrow (+new/detail/person) | `/lend-borrow*` | Stat cards, tabs, status chips, repayment timeline, person net-position |
| Recurring | `/recurring` | List with next-due/Paused; row → sheet |
| Subscriptions | `/subscriptions` | Cost tiles, renewing-soon alerts, brand icons |
| Monthly Review | `/reviews` | Month pager, stat tiles, highlights, category changes, top spaces, subscriptions, accounts |
| Reports | `/reports` | Range summary, category breakdown, budget performance, CSV/PDF |
| Settings | `/settings` | Profile, budgets, currency, tags, reminders toggle, backup/import, sign out |
| Login / OAuth callback | `/login`, `/auth/callback` | 4 providers; PAT sheet fallback |

## Bottom sheets (18, via `sheet-context.tsx` single `ActiveSheet` union)

action (launcher) · expense · income · transfer · cc-payment · investment · recurring-investment · recurring (4 kind tabs) · goal · budget · account · space · subscription · group (create-only) · group-expense (split tabs + live validation) · search · reconcile · adjust-balance (hard-reset switch). All reset state on open; all validate before submit; edit modes add Delete/Pause/Archive as appropriate. Shared patterns: big-amount hero input, progressive "extras" section, pending-attachment upload on create.

## Reusable components

- **ui/** primitives (13): badge, button, dialog, dropdown-menu, input, label, popover, progress, select, sheet (vaul), skeleton, tabs, textarea.
- **Fields**: AccountSelect (institution icons; `allowNone`; dead `includeInvestment` prop), SpaceSelect, DateField (styled native input), TimeRangePicker, TagInput (chips + suggestions), EmojiPicker, AffectBalanceToggle, ShowInvestmentsToggle, AttachmentManager (expense/lendBorrow modes).
- **Charts**: CategoryDonut (recharts pie + center total), SpendBars (bar; only used in Space detail) — both dynamic-imported.
- **Rows/cards**: ExpenseRow (pointer-tracked swipe-left → Edit/Delete, single-open-row, type-aware icon/amount coloring, brand accent), AccountCard (gradient brand-tinted card visual), EmptyState, InsightsStrip (snap-scroll cards), AccountMetadataView (CC ring / bank details with mask+reveal), DebitCardsSection, AttachmentGallery, QrCode, BrandIcon/InstitutionIcon/CategoryIcon, QuickAddInput, PwaManager (headless), AuthGate.

## Design system (`app/globals.css`)

- **Tailwind v4 CSS-first** (`@theme inline`), tokens on `:root`: oklch grayscale core, `--destructive` red, `--positive` green; radius scale from `--radius: 0.875rem`; shadows `--shadow-soft/float/sheet`; motion `--ease-spring: cubic-bezier(0.32,0.72,0,1)`; `prefers-reduced-motion` kills animation; scrollbars hidden globally.
- **Dark-only**: single palette, `html{color-scheme:dark}`. No light theme, no `prefers-color-scheme`. Yet ~15 files use raw `emerald/amber/blue/green` classes and stray `dark:` variants — token drift.
- Typography: Geist Sans; de-facto scale via bracket sizes (`text-[15px]` titles, `[13px]` secondary, `[12px]` labels, `text-[2.75rem]` hero); `tabular-nums` for money everywhere.
- iOS-PWA affordances: safe-area insets, `viewportFit: cover`, black-translucent status bar, zoom locked (`maximumScale: 1`), `interactiveWidget: resizes-visual`.
- Icons: lucide-react + custom GitHub/Google SVGs; brand favicons via favicone→Google fallback chain; institution SVGs hardcoded for hdfc/sbi/visa/mastercard with Clearbit→Google fallback and letter-avatar last resort.

> Note: project memory described a "design system v2" with semantic type utilities and ListSection/ListRow primitives — **these do not exist in the code**. Lists are hand-rolled per view; the bracket sizes are the real system.

## UX gaps (verified)

1. **Group edit unreachable** — `openGroup(group?)` supports editing but `GroupSheet` ignores it; groups can't be renamed, members can't be removed.
2. **Transfers/CC payments uneditable** — row tap and swipe-Edit silently no-op for those types.
3. **Search dead-ends** — category results navigate to `/expenses` without applying the filter; tags advertised but unsupported; 8-result cap with no "see all".
4. **Debit cards** — delete only on hover (invisible on touch); "today's spending" always ₹0 (`debitCardId` never set); missing `/noise.png`.
5. **Calendar week view has no pager** (anchor only changes in Day mode).
6. Group expenses can't be back-dated (`date: todayISO()` hardcoded).
7. Recurring empty state lacks an action button (unlike Groups).
8. Sync-error icon is not actionable.
9. AccountsView allocation colors are index-based (a given account's color shifts as the list changes); debt-inclusive percentages computed against a net total are misleading.
10. Lend & Borrow breaks the sheet pattern (full pages, native `confirm()`, raw date input).
11. ExpenseSheet amount field accepts multiple dots.
12. Icon CDNs make brand/institution icons online-only (fallbacks render offline).
13. No `beforeinstallprompt` handling — PWA install is left to browser defaults.
