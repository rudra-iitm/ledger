"use client";

import Link from "next/link";
import {
  CalendarClock,
  CalendarCheck,
  ChevronRight,
  FileText,
  HeartPulse,
  Inbox,
  LayoutGrid,
  LineChart,
  ReceiptText,
  RefreshCw,
  Target,
  TrendingDown,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import { ExpenseRow } from "@/components/expense-row";
import { EmptyState } from "@/components/empty-state";
import { InsightsStrip } from "@/components/insights-strip";
import { AiBriefing } from "@/components/ai-briefing";
import { QuickAddInput } from "@/components/quick-add-input";
import { useSheets } from "@/components/sheets/sheet-context";
import { Progress } from "@/components/ui/progress";
import { budgetSummary, categoryBudgetSummaries } from "@/lib/domain/budget";
import { isInvestment, visibleInExpenseList } from "@/lib/domain/transactions";
import { ShowInvestmentsToggle } from "@/components/fields/show-investments-toggle";
import { currentMonth, formatDisplayDate, formatDisplayMonth } from "@/lib/domain/dates";
import { projectCashFlow } from "@/lib/domain/forecast";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const expenses = useAppStore((state) => state.data.expenses);
  const budgets = useAppStore((state) => state.data.budgets);
  const monthlyBudget = budgets.monthlyBudget;
  const currency = useAppStore((state) => state.data.settings.currency);
  const recurring = useAppStore((state) => state.data.recurring);
  const subscriptions = useAppStore((state) => state.data.subscriptions);
  const recurringInvestments = useAppStore(
    (state) => state.data.recurringInvestments,
  );
  const accounts = useAppStore((state) => state.data.accounts);
  const showInvestmentsInExpenses = useAppStore(
    (state) => state.data.settings.showInvestmentsInExpenses,
  );
  const sheets = useSheets();
  const forecast = projectCashFlow({
    recurring,
    subscriptions,
    recurringInvestments,
    accounts,
  });
  const hasSchedules =
    recurring.some((item) => item.active) ||
    subscriptions.some((item) => item.active) ||
    recurringInvestments.some((item) => item.active);

  const month = currentMonth();
  const summary = budgetSummary(expenses, monthlyBudget, month);
  const categoryAlerts = categoryBudgetSummaries(expenses, budgets, month).filter(
    (item) => item.nearLimit || item.overBudget,
  );
  const recent = visibleInExpenseList(expenses, showInvestmentsInExpenses)
    .slice()
    .sort((a, b) =>
      a.date === b.date
        ? b.createdAt.localeCompare(a.createdAt)
        : b.date.localeCompare(a.date),
    )
    .slice(0, 5);
  const overBudget = monthlyBudget > 0 && summary.remaining < 0;
  const hasInvestments = expenses.some(isInvestment);

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="This month">
        <p className="text-sm text-muted-foreground">
          {formatDisplayMonth(month)}
        </p>
        <p className="mt-1 text-[2.75rem] leading-none font-semibold tracking-tight tabular-nums">
          {formatMoney(summary.spent, currency)}
        </p>
        {monthlyBudget > 0 ? (
          <div className="mt-5 flex flex-col gap-2">
            <Progress
              value={summary.progress * 100}
              aria-label="Budget used"
              indicatorClassName={cn(overBudget && "bg-destructive")}
            />
            <p className="text-sm text-muted-foreground">
              {overBudget ? (
                <span className="text-destructive">
                  {formatMoney(Math.abs(summary.remaining), currency)} over your{" "}
                  {formatMoney(summary.budget, currency)} budget
                </span>
              ) : (
                <>
                  {formatMoney(summary.remaining, currency)} left of{" "}
                  {formatMoney(summary.budget, currency)}
                </>
              )}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => sheets.openBudget()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Target aria-hidden className="size-4" />
            Set a monthly budget
            <ChevronRight aria-hidden className="size-3.5" />
          </button>
        )}
      </section>

      <section aria-label="Quick add">
        <QuickAddInput />
      </section>

      {categoryAlerts.length > 0 && (
        <section aria-label="Budget alerts" className="flex flex-col gap-2">
          {categoryAlerts.map((alert) => (
            <button
              key={alert.category}
              type="button"
              onClick={() => sheets.openBudget()}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left outline-none transition-[background-color,transform] duration-200 ease-spring active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring",
                alert.overBudget
                  ? "border-destructive/40 bg-destructive/10"
                  : "border-amber-400/30 bg-amber-400/10",
              )}
            >
              <TriangleAlert
                aria-hidden
                className={cn(
                  "size-4 shrink-0",
                  alert.overBudget ? "text-destructive" : "text-amber-400",
                )}
              />
              <span className="flex-1 text-[14px]">
                {alert.category}{" "}
                {alert.overBudget ? "over budget" : "near its limit"}
              </span>
              <span className="text-[13px] tabular-nums text-muted-foreground">
                {formatMoney(alert.spent, currency)} /{" "}
                {formatMoney(alert.budget, currency)}
              </span>
            </button>
          ))}
        </section>
      )}

      <AiBriefing />

      <InsightsStrip />

      {hasSchedules && (
        <Link
          href="/calendar"
          aria-label="Cash-flow forecast"
          className={cn(
            "flex items-center gap-3 rounded-2xl border px-4 py-3.5 outline-none transition-[background-color,transform] duration-200 ease-spring active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring",
            forecast.firstNegative
              ? "border-destructive/40 bg-destructive/10"
              : "border-border bg-card shadow-soft hover:bg-accent/50",
          )}
        >
          <TrendingDown
            aria-hidden
            className={cn(
              "size-4 shrink-0",
              forecast.firstNegative
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          />
          <span className="flex-1 text-[14px]">
            {forecast.firstNegative ? (
              <>
                Projected to go negative on{" "}
                <span className="font-medium">
                  {formatDisplayDate(forecast.firstNegative.date)}
                </span>
              </>
            ) : (
              <>Next 90 days look covered</>
            )}
          </span>
          <span className="text-right text-[13px] tabular-nums text-muted-foreground">
            low {formatMoney(forecast.lowest.balance, currency)}
            <br />
            {formatDisplayDate(forecast.lowest.date)}
          </span>
        </Link>
      )}

      <section aria-label="Shortcuts" className="grid grid-cols-2 gap-3">
        {[
          { href: "/health", label: "Health", icon: HeartPulse },
          { href: "/inbox", label: "Inbox", icon: Inbox },
          { href: "/spaces", label: "Spaces", icon: LayoutGrid },
          { href: "/accounts", label: "Accounts", icon: Wallet },
          { href: "/investments", label: "Investments", icon: LineChart },
          { href: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
          { href: "/reviews", label: "Monthly Review", icon: CalendarCheck },
          { href: "/groups", label: "Groups", icon: Users },
          { href: "/recurring", label: "Recurring", icon: CalendarClock },
          { href: "/reports", label: "Reports", icon: FileText },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-soft outline-none transition-[background-color,transform] duration-200 ease-spring hover:bg-accent/50 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon aria-hidden className="size-5 text-muted-foreground" />
            <span className="text-[14px] font-medium">{label}</span>
          </Link>
        ))}
      </section>

      <section aria-label="Recent expenses">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Recent</h2>
          <div className="flex items-center gap-2">
            {hasInvestments && <ShowInvestmentsToggle />}
            {expenses.length > 0 && (
              <Link
                href="/expenses"
                className="inline-flex items-center gap-0.5 rounded-lg text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                See all
                <ChevronRight aria-hidden className="size-3.5" />
              </Link>
            )}
          </div>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No expenses yet"
            description='Type something like "lunch 450" above to add your first expense.'
          />
        ) : (
          <ul className="-mx-2 flex flex-col">
            {recent.map((expense) => (
              <ExpenseRow key={expense.id} expense={expense} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
