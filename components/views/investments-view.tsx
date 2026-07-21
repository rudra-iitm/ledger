"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronRight,
  LineChart,
  Plus,
  RefreshCw,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { WealthOverview } from "@/components/wealth/wealth-overview";
import { ExpenseRow } from "@/components/expense-row";
import { isInvestment } from "@/lib/domain/transactions";
import { useSheets } from "@/components/sheets/sheet-context";
import { resolveInstitution } from "@/lib/institutions/registry";
import { InstitutionIcon } from "@/components/institution-icon";
import { formatMoney } from "@/lib/domain/money";
import { formatDisplayDate } from "@/lib/domain/dates";
import {
  buildPortfolio,
  goalProgress,
} from "@/lib/domain/investments";
import { nextInvestmentDate } from "@/lib/domain/recurring-investments";
import { ASSET_TYPE_LABELS } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function InvestmentsView() {
  const accounts = useAppStore((state) => state.data.accounts);
  const expenses = useAppStore((state) => state.data.expenses);
  const schedules = useAppStore((state) => state.data.recurringInvestments);
  const goals = useAppStore((state) => state.data.goals);
  const currency = useAppStore((state) => state.data.settings.currency);
  const refreshPrices = useAppStore((state) => state.refreshPrices);
  const sheets = useSheets();
  const [refreshing, setRefreshing] = useState(false);

  const canRefresh = useMemo(
    () =>
      accounts.some(
        (account) =>
          account.type === "investment" &&
          !account.archived &&
          (account.assetType === "gold" ||
            account.assetType === "silver" ||
            Boolean(account.priceId)),
      ),
    [accounts],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshPrices();
      toast.success("Prices updated");
    } catch {
      toast.error("Couldn't fetch prices");
    } finally {
      setRefreshing(false);
    }
  };

  const portfolio = useMemo(
    () => buildPortfolio(accounts, expenses),
    [accounts, expenses],
  );
  const goalRows = useMemo(
    () => goals.map((goal) => goalProgress(goal, accounts, expenses)),
    [goals, accounts, expenses],
  );
  const transactions = useMemo(
    () =>
      expenses
        .filter(isInvestment)
        .sort((a, b) =>
          a.date === b.date
            ? b.createdAt.localeCompare(a.createdAt)
            : b.date.localeCompare(a.date),
        ),
    [expenses],
  );

  return (
    <div className="flex flex-col gap-6">
      <WealthOverview />

      {/*
        Actions only. The portfolio's value moved into WealthOverview above —
        this screen used to open with two competing hero figures ("Net worth"
        and "Current value"), which left neither of them being the answer to
        "how am I doing".
      */}
      <section aria-label="Portfolio actions" className="flex gap-2">
        <Button className="flex-1" onClick={() => sheets.openInvestment()}>
          <Plus aria-hidden />
          Invest
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => sheets.openRecurringInvestment()}
        >
          <CalendarClock aria-hidden />
          Recurring
        </Button>
      </section>

      <section aria-label="Holdings">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-medium text-muted-foreground">Holdings</h2>
          {canRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <RefreshCw
                aria-hidden
                className={cn("size-3.5", refreshing && "animate-spin")}
              />
              {refreshing ? "Updating…" : "Refresh prices"}
            </button>
          )}
        </div>
        {portfolio.holdings.length === 0 ? (
          <EmptyState
            icon={LineChart}
            title="No holdings yet"
            description="Record a gold, silver, or SIP purchase to start tracking your assets."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {portfolio.holdings.map((holding) => (
              <li key={holding.account.id}>
                <button
                  type="button"
                  onClick={() => sheets.openInvestment(holding.account.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-soft outline-none transition-[background-color,transform] duration-200 ease-spring active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <InstitutionIcon
                    institution={holding.account.assetType === "gold" || holding.account.assetType === "silver" ? null : resolveInstitution(holding.account.name)}
                    type={holding.account.type}
                    assetType={holding.account.assetType}
                    size="md"
                    className="shrink-0"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-medium">
                      {holding.account.name}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {holding.account.assetType
                        ? ASSET_TYPE_LABELS[holding.account.assetType]
                        : "Investment"}
                      {holding.units > 0 && (
                        <>
                          {" · "}
                          {holding.units} {holding.account.unitLabel ?? "units"}
                        </>
                      )}
                      {holding.averagePrice !== null && (
                        <> · avg {formatMoney(holding.averagePrice, currency)}</>
                      )}
                    </span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="text-[15px] font-semibold tabular-nums">
                      {formatMoney(holding.currentValue, currency)}
                    </span>
                    {holding.account.currentPrice !== undefined && (
                      <span
                        className={cn(
                          "text-[12px] tabular-nums",
                          holding.gain >= 0
                            ? "text-emerald-500"
                            : "text-destructive",
                        )}
                      >
                        {holding.gain >= 0 ? "+" : ""}
                        {formatMoney(holding.gain, currency)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {transactions.length > 0 && (
        <section aria-label="Investment transactions">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <h2 className="text-sm font-medium text-muted-foreground">
              Transactions
            </h2>
            <Link
              href="/investments/transactions"
              className="inline-flex items-center gap-0.5 rounded-lg text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              See all
              <ChevronRight aria-hidden className="size-3.5" />
            </Link>
          </div>
          <ul className="-mx-2 flex flex-col">
            {transactions.slice(0, 5).map((transaction) => (
              <ExpenseRow key={transaction.id} expense={transaction} />
            ))}
          </ul>
        </section>
      )}

      {schedules.length > 0 && (
        <section aria-label="Recurring investments">
          <h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
            Schedules
          </h2>
          <ul className="flex flex-col gap-3">
            {schedules.map((schedule) => (
              <li key={schedule.id}>
                <button
                  type="button"
                  onClick={() => sheets.openRecurringInvestment(schedule)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-soft outline-none transition-[background-color,transform] duration-200 ease-spring active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <InstitutionIcon
                    institution={schedule.assetType === "gold" || schedule.assetType === "silver" ? null : resolveInstitution(schedule.name)}
                    type="investment"
                    assetType={schedule.assetType}
                    size="xs"
                    className="shrink-0"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-medium">
                      {schedule.name}
                    </span>
                    <span className="text-[13px] capitalize text-muted-foreground">
                      {schedule.frequency} · next{" "}
                      {formatDisplayDate(nextInvestmentDate(schedule))}
                    </span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">
                    {formatMoney(schedule.amount, currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Goals">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-medium text-muted-foreground">Goals</h2>
          <Button size="sm" variant="ghost" onClick={() => sheets.openGoal()}>
            <Plus aria-hidden />
            New
          </Button>
        </div>
        {goalRows.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Set a target like an emergency fund or gold accumulation and track it automatically."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {goalRows.map(({ goal, current, target, progress, remaining }) => (
              <li key={goal.id}>
                <button
                  type="button"
                  onClick={() => sheets.openGoal(goal)}
                  className="flex w-full flex-col gap-2.5 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-soft outline-none transition-[background-color,transform] duration-200 ease-spring active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden className="text-lg">
                      {goal.icon}
                    </span>
                    <span className="flex-1 truncate text-[15px] font-medium">
                      {goal.name}
                    </span>
                    <span className="text-[13px] tabular-nums text-muted-foreground">
                      {Math.round(progress * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[12px] text-muted-foreground tabular-nums">
                    <span>
                      {formatMoney(current, currency)} of{" "}
                      {formatMoney(target, currency)}
                    </span>
                    {remaining > 0 && (
                      <span>{formatMoney(remaining, currency)} to go</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
