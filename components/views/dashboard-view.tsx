"use client";

import Link from "next/link";
import {
  ChevronRight,
  HeartPulse,
  Inbox,
  LineChart,
  ReceiptText,
  Target,
  Wallet,
} from "lucide-react";
import { SignalFeed } from "@/components/agent/signal-feed";
import { ExpenseRow } from "@/components/expense-row";
import { EmptyState } from "@/components/empty-state";
import { QuickAddInput } from "@/components/quick-add-input";
import { useSheets } from "@/components/sheets/sheet-context";
import { Progress } from "@/components/ui/progress";
import { budgetSummary } from "@/lib/domain/budget";
import { isInvestment, visibleInExpenseList } from "@/lib/domain/transactions";
import { ShowInvestmentsToggle } from "@/components/fields/show-investments-toggle";
import { currentMonth, formatDisplayMonth } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const expenses = useAppStore((state) => state.data.expenses);
  const monthlyBudget = useAppStore((state) => state.data.budgets.monthlyBudget);
  const currency = useAppStore((state) => state.data.settings.currency);
  const showInvestmentsInExpenses = useAppStore(
    (state) => state.data.settings.showInvestmentsInExpenses,
  );
  const sheets = useSheets();

  const month = currentMonth();
  const summary = budgetSummary(expenses, monthlyBudget, month);
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

      <SignalFeed />

      {/*
        Four destinations, not ten. The other six were a menu pretending to be
        a dashboard — everything on this screen now either tells you something
        or is where you go next, and the rest lives one tap away in the
        account menu where a directory belongs.
      */}
      <section aria-label="Shortcuts" className="grid grid-cols-2 gap-3">
        {[
          { href: "/accounts", label: "Accounts", icon: Wallet },
          { href: "/investments", label: "Investments", icon: LineChart },
          { href: "/inbox", label: "Inbox", icon: Inbox },
          { href: "/health", label: "Health", icon: HeartPulse },
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
