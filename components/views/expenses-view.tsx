"use client";

import { useMemo, useState } from "react";
import { ReceiptText, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ExpenseRow } from "@/components/expense-row";
import { CATEGORIES, type Category } from "@/lib/domain/types";
import { formatDisplayDate } from "@/lib/domain/dates";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function ExpensesView() {
  const expenses = useAppStore((state) => state.data.expenses);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...expenses]
      .filter((expense) => {
        if (category && expense.category !== category) return false;
        if (
          normalized &&
          !expense.description.toLowerCase().includes(normalized)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) =>
        a.date === b.date
          ? b.createdAt.localeCompare(a.createdAt)
          : b.date.localeCompare(a.date),
      );
  }, [expenses, query, category]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const expense of filtered) {
      const list = groups.get(expense.date) ?? [];
      list.push(expense);
      groups.set(expense.date, list);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 rounded-2xl border border-input bg-card px-3.5 transition-colors focus-within:border-ring">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search expenses"
          placeholder="Search expenses"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-10 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div
        role="group"
        aria-label="Filter by category"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]"
      >
        {[null, ...CATEGORIES].map((item) => {
          const selected = category === item;
          return (
            <button
              key={item ?? "all"}
              type="button"
              aria-pressed={selected}
              onClick={() => setCategory(item)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {item ?? "All"}
            </button>
          );
        })}
      </div>

      {groupedByDate.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={
            expenses.length === 0 ? "No expenses yet" : "Nothing matches"
          }
          description={
            expenses.length === 0
              ? "Tap the plus button to add your first expense."
              : "Try a different search or category filter."
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {groupedByDate.map(([date, items]) => (
            <section key={date} aria-label={formatDisplayDate(date)}>
              <h2 className="mb-1 px-0.5 text-sm font-medium text-muted-foreground">
                {formatDisplayDate(date)}
              </h2>
              <ul className="-mx-2 flex flex-col">
                {items.map((expense) => (
                  <ExpenseRow key={expense.id} expense={expense} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
