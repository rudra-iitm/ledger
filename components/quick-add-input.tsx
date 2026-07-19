"use client";

import { useMemo, useState } from "react";
import { ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { parseQuickAdd } from "@/lib/domain/quick-add";
import { applyRulesToQuickExpense } from "@/lib/domain/ingest/rules";
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
  const rules = useAppStore((state) => state.data.rules);
  const currency = useAppStore((state) => state.data.settings.currency);

  // Rules refine the parser's guess (category, rename, tags) live.
  const parsed = useMemo(() => {
    const raw = parseQuickAdd(value);
    if (!raw) return null;
    return applyRulesToQuickExpense(
      { ...raw, tags: [] as string[], spaceId: undefined as string | undefined },
      rules,
    ).expense;
  }, [value, rules]);

  const submit = () => {
    if (!parsed) return;
    addExpense({
      description: parsed.description,
      amount: parsed.amount,
      type: "expense" as const,
      category: parsed.category,
      tags: parsed.tags,
      spaceId: parsed.spaceId,
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
      <div className="flex h-12 items-center gap-2 rounded-xl border border-input bg-card px-2 pl-4 shadow-soft transition-[border-color,box-shadow,background-color] duration-200 focus-within:border-ring/60 focus-within:bg-accent/30 focus-within:ring-4 focus-within:ring-ring/15">
        <input
          aria-label="Quick add expense"
          autoFocus={autoFocus}
          enterKeyHint="done"
          autoComplete="off"
          spellCheck={false}
          placeholder='Try "lunch 450" or "uber 280"'
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-full w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          aria-label="Add expense"
          disabled={!parsed}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none transition-[transform,opacity] duration-200 ease-spring focus-visible:ring-2 focus-visible:ring-ring active:scale-90 disabled:opacity-30"
        >
          <ArrowUp aria-hidden className="size-4" />
        </button>
      </div>
      <div aria-live="polite" className="min-h-7 pt-1.5">
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
