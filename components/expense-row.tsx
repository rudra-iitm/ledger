"use client";

import { CalendarClock } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import type { Expense } from "@/lib/domain/types";
import { formatDisplayDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { useSheets } from "@/components/sheets/sheet-context";
import { useAppStore } from "@/lib/store/app-store";

export function ExpenseRow({ expense }: { expense: Expense }) {
  const sheets = useSheets();
  const currency = useAppStore((state) => state.data.settings.currency);

  return (
    <li>
      <button
        type="button"
        onClick={() => sheets.openExpense(expense)}
        className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CategoryIcon category={expense.category} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5 truncate text-[15px] font-medium">
            {expense.description}
            {expense.recurringId && (
              <CalendarClock
                aria-label="Recurring"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
            )}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {expense.category} · {formatDisplayDate(expense.date)}
          </span>
        </span>
        <span className="text-[15px] font-semibold tabular-nums">
          {formatMoney(expense.amount, currency)}
        </span>
      </button>
    </li>
  );
}
