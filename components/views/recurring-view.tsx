"use client";

import { CalendarClock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { useSheets } from "@/components/sheets/sheet-context";
import { nextDueDate } from "@/lib/domain/recurring";
import { formatDisplayDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";

export function RecurringView() {
  const recurring = useAppStore((state) => state.data.recurring);
  const currency = useAppStore((state) => state.data.settings.currency);
  const sheets = useSheets();

  if (recurring.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No recurring expenses"
        description="Add rent, internet, or subscriptions and they will appear in your expenses automatically when due."
        action={
          <Button variant="secondary" onClick={() => sheets.openRecurring()}>
            <Plus aria-hidden />
            Add recurring
          </Button>
        }
      />
    );
  }

  const sorted = [...recurring].sort((a, b) =>
    a.active === b.active
      ? a.description.localeCompare(b.description)
      : a.active
        ? -1
        : 1,
  );

  return (
    <ul className="-mx-2 flex flex-col">
      {sorted.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => sheets.openRecurring(item)}
            className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CategoryIcon category={item.category} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-medium">
                {item.description}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {item.active
                  ? `Next on ${formatDisplayDate(nextDueDate(item))}`
                  : "Paused"}
              </span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className="text-[15px] font-semibold tabular-nums">
                {formatMoney(item.amount, currency)}
              </span>
              {!item.active && <Badge variant="outline">Paused</Badge>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
