"use client";

import { useMemo, useState } from "react";
import { FileDown, FileText } from "lucide-react";
import {
  TimeRangePicker,
  type TimeFilterValue,
} from "@/components/fields/time-range-picker";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { breakdownByCategory, filterExpenses, totalSpending } from "@/lib/domain/analytics";
import { categoryBudgetSummaries } from "@/lib/domain/budget";
import { resolveRange, TIME_PRESET_LABELS } from "@/lib/domain/time-ranges";
import { formatMoney } from "@/lib/domain/money";
import { buildReportData, expensesToCsv } from "@/lib/domain/reports";
import { downloadCsv, downloadReportPdf } from "@/lib/export/files";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function ReportsView() {
  const expenses = useAppStore((state) => state.data.expenses);
  const budgets = useAppStore((state) => state.data.budgets);
  const settings = useAppStore((state) => state.data.settings);
  const accounts = useAppStore((state) => state.data.accounts);
  const [filter, setFilter] = useState<TimeFilterValue>({
    preset: "thisMonth",
    custom: { start: null, end: null },
  });

  const range = useMemo(
    () => resolveRange(filter.preset, filter.custom),
    [filter],
  );
  const filtered = useMemo(
    () => filterExpenses(expenses, { range }),
    [expenses, range],
  );
  const breakdown = useMemo(() => breakdownByCategory(filtered), [filtered]);
  const total = totalSpending(filtered);
  const categoryBudgets = categoryBudgetSummaries(expenses, budgets);

  const periodLabel =
    filter.preset === "custom"
      ? `${range.start ?? "Beginning"} → ${range.end ?? "Today"}`
      : TIME_PRESET_LABELS[filter.preset];

  const exportCsv = () =>
    downloadCsv(
      "ledger-report.csv",
      expensesToCsv(filtered, {
        accounts,
        currency: settings.currency,
      }),
    );

  const exportPdf = () =>
    void downloadReportPdf(
      "ledger-report.pdf",
      buildReportData("Spending report", periodLabel, filtered),
      settings.currency,
    );

  return (
    <div className="flex flex-col gap-6">
      <TimeRangePicker value={filter} onChange={setFilter} />

      <section
        aria-label="Summary"
        className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-5 py-5"
      >
        <span className="text-[13px] text-muted-foreground">{periodLabel}</span>
        <span className="text-3xl font-semibold tabular-nums">
          {formatMoney(total, settings.currency)}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "transaction" : "transactions"}
        </span>
      </section>

      <section aria-label="Category breakdown">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Category breakdown
        </h2>
        {breakdown.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
            No spending in this period.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {breakdown.map((entry) => (
              <li
                key={entry.category}
                className="flex items-center justify-between px-1 py-1.5 text-[15px]"
              >
                <span>{entry.category}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="tabular-nums">
                    {Math.round(entry.percentage)}%
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatMoney(entry.total, settings.currency)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {categoryBudgets.length > 0 && (
        <section aria-label="Budget performance">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Budget performance (this month)
          </h2>
          <ul className="flex flex-col gap-3">
            {categoryBudgets.map((summary) => (
              <li key={summary.category} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[14px]">
                  <span>{summary.category}</span>
                  <span
                    className={cn(
                      "tabular-nums",
                      summary.overBudget
                        ? "text-destructive"
                        : summary.nearLimit
                          ? "text-amber-400"
                          : "text-muted-foreground",
                    )}
                  >
                    {formatMoney(summary.spent, settings.currency)} /{" "}
                    {formatMoney(summary.budget, settings.currency)}
                  </span>
                </div>
                <Progress
                  value={summary.progress * 100}
                  indicatorClassName={cn(
                    summary.overBudget && "bg-destructive",
                    summary.nearLimit && "bg-amber-400",
                  )}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Export" className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={exportCsv}
          disabled={filtered.length === 0}
        >
          <FileDown aria-hidden />
          Export CSV
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={exportPdf}
          disabled={filtered.length === 0}
        >
          <FileText aria-hidden />
          Export PDF
        </Button>
      </section>
    </div>
  );
}
