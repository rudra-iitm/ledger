"use client";

import { useMemo, useState } from "react";
import { ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { parseQuickAdd } from "@/lib/domain/quick-add";
import { todayISO } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { Badge } from "@/components/ui/badge";

export function QuickAddInput({
  autoFocus = false,
  onAdded,
}: {
  autoFocus?: boolean;
  onAdded?: () => void;
}) {
  const [value, setValue] = useState("");
  const addExpense = useAppStore((state) => state.addExpense);
  const currency = useAppStore((state) => state.data.settings.currency);

  const parsed = useMemo(() => parseQuickAdd(value), [value]);

  const submit = () => {
    if (!parsed) return;
    addExpense({
      description: parsed.description,
      amount: parsed.amount,
      category: parsed.category,
      date: todayISO(),
    });
    toast.success(
      `Added ${parsed.description} · ${formatMoney(parsed.amount, currency)}`,
    );
    setValue("");
    onAdded?.();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-2 rounded-2xl border border-input bg-card px-3.5 py-1.5 transition-colors focus-within:border-ring">
        <input
          aria-label="Quick add expense"
          autoFocus={autoFocus}
          enterKeyHint="done"
          autoComplete="off"
          spellCheck={false}
          placeholder='Try "lunch 450" or "uber 280"'
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-10 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          aria-label="Add expense"
          disabled={!parsed}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
        >
          <ArrowUp aria-hidden className="size-4" />
        </button>
      </div>
      <div aria-live="polite" className="min-h-8 pt-2">
        {parsed && (
          <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <span className="truncate">
              {parsed.description} · {formatMoney(parsed.amount, currency)}
            </span>
            <Badge variant="outline">{parsed.category}</Badge>
          </p>
        )}
      </div>
    </form>
  );
}
