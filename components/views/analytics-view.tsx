"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart3, FileDown, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { InsightsStrip } from "@/components/insights-strip";
import {
  TimeRangePicker,
  type TimeFilterValue,
} from "@/components/fields/time-range-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_COLORS } from "@/lib/domain/category-meta";
import {
  breakdownByCategory,
  filterExpenses,
  totalSpending,
} from "@/lib/domain/analytics";
import { resolveRange } from "@/lib/domain/time-ranges";
import { formatMoney } from "@/lib/domain/money";
import { buildReportData, expensesToCsv } from "@/lib/domain/reports";
import { downloadCsv, downloadReportPdf } from "@/lib/export/files";
import { useAppStore } from "@/lib/store/app-store";

const CategoryDonut = dynamic(
  () => import("@/components/charts/category-donut").then((m) => m.CategoryDonut),
  {
    ssr: false,
    loading: () => <Skeleton className="mx-auto size-48 rounded-full" />,
  },
);

const ALL_ACCOUNTS = "__all__";

export function AnalyticsView() {
  const expenses = useAppStore((state) => state.data.expenses);
  const accounts = useAppStore((state) => state.data.accounts);
  const settings = useAppStore((state) => state.data.settings);
  const [filter, setFilter] = useState<TimeFilterValue>({
    preset: "thisMonth",
    custom: { start: null, end: null },
  });
  const [accountId, setAccountId] = useState<string>(ALL_ACCOUNTS);

  const range = useMemo(
    () => resolveRange(filter.preset, filter.custom),
    [filter],
  );

  const filtered = useMemo(
    () =>
      filterExpenses(expenses, {
        range,
        accountId: accountId === ALL_ACCOUNTS ? null : accountId,
      }),
    [expenses, range, accountId],
  );

  const total = totalSpending(filtered);
  const breakdown = useMemo(() => breakdownByCategory(filtered), [filtered]);

  const accountBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of filtered) {
      if (!expense.accountId) continue;
      totals.set(
        expense.accountId,
        (totals.get(expense.accountId) ?? 0) + expense.amount,
      );
    }
    return accounts
      .map((account) => ({ account, total: totals.get(account.id) ?? 0 }))
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filtered, accounts]);

  const exportCsv = () => {
    downloadCsv(
      "ledger-expenses.csv",
      expensesToCsv(filtered, { accounts, currency: settings.currency }),
    );
  };

  const exportPdf = () => {
    void downloadReportPdf(
      "ledger-report.pdf",
      buildReportData(
        "Spending report",
        `${range.start ?? "Beginning"} → ${range.end ?? "Today"}`,
        filtered,
      ),
      settings.currency,
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <TimeRangePicker value={filter} onChange={setFilter} />
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="h-9 w-auto rounded-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ACCOUNTS}>All accounts</SelectItem>
            {accounts
              .filter((account) => !account.archived)
              .map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.icon} {account.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <InsightsStrip />

      {filtered.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No spending in this period"
          description="Pick a different time range or add some expenses."
        />
      ) : (
        <>
          <section aria-label="Category breakdown" className="flex flex-col gap-5">
            <CategoryDonut
              data={breakdown}
              total={total}
              currency={settings.currency}
            />
            <ul className="flex flex-col gap-1">
              {breakdown.map((entry) => (
                <li
                  key={entry.category}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5"
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[entry.category] }}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-medium">
                      {entry.category}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {entry.count} {entry.count === 1 ? "txn" : "txns"} ·{" "}
                      {Math.round(entry.percentage)}%
                    </span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">
                    {formatMoney(entry.total, settings.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {accountBreakdown.length > 0 && (
            <section aria-label="By account">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                By account
              </h2>
              <ul className="flex flex-col gap-1">
                {accountBreakdown.map(({ account, total: accountTotal }) => (
                  <li
                    key={account.id}
                    className="flex items-center justify-between px-2 py-2 text-[15px]"
                  >
                    <span>
                      {account.icon} {account.name}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(accountTotal, settings.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Export" className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={exportCsv}>
              <FileDown aria-hidden />
              Export CSV
            </Button>
            <Button variant="outline" className="flex-1" onClick={exportPdf}>
              <FileText aria-hidden />
              Export PDF
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
