"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { suggestBudgets } from "@/lib/domain/budget";
import { CATEGORIES, type Category } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";

export function BudgetSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const budgets = useAppStore((state) => state.data.budgets);
  const expenses = useAppStore((state) => state.data.expenses);
  const currency = useAppStore((state) => state.data.settings.currency);
  const setMonthlyBudget = useAppStore((state) => state.setMonthlyBudget);
  const setCategoryBudget = useAppStore((state) => state.setCategoryBudget);

  const [overall, setOverall] = useState("");
  const [categoryValues, setCategoryValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setOverall(budgets.monthlyBudget > 0 ? String(budgets.monthlyBudget) : "");
    const next: Record<string, string> = {};
    for (const category of CATEGORIES) {
      const value = budgets.categoryBudgets[category];
      if (value && value > 0) next[category] = String(value);
    }
    setCategoryValues(next);
  }, [open, budgets]);

  const applySuggestions = () => {
    const suggestion = suggestBudgets(expenses);
    const entries = Object.entries(suggestion.categoryBudgets);
    if (entries.length === 0) {
      toast("Not enough history yet — track a couple of months of spending first.");
      return;
    }
    setOverall(String(suggestion.monthlyBudget));
    setCategoryValues((current) => {
      const next = { ...current };
      for (const [category, value] of entries) next[category] = String(value);
      return next;
    });
    toast.success(
      `Suggested from your last 3 months (${entries.length} categories) — review and save`,
    );
  };

  const submit = () => {
    const parsedOverall = Number(overall);
    setMonthlyBudget(
      overall !== "" && Number.isFinite(parsedOverall) && parsedOverall >= 0
        ? parsedOverall
        : 0,
    );
    for (const category of CATEGORIES) {
      const raw = categoryValues[category];
      const parsed = Number(raw);
      setCategoryBudget(
        category,
        raw && Number.isFinite(parsed) && parsed > 0 ? parsed : null,
      );
    }
    toast.success("Budget updated");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Budgets</SheetTitle>
          <SheetDescription>
            Set an overall monthly limit and optional per-category limits.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={applySuggestions}
          >
            <Sparkles aria-hidden />
            Suggest from my last 3 months
          </Button>

          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-overall">Monthly budget</Label>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3.5">
              <span className="text-muted-foreground">{currency}</span>
              <input
                id="budget-overall"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="30000"
                value={overall}
                onChange={(event) => setOverall(event.target.value)}
                className="h-10 w-full bg-transparent text-base outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Category budgets</Label>
            <div className="flex flex-col gap-2">
              {CATEGORIES.map((category: Category) => (
                <div
                  key={category}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-1.5"
                >
                  <span className="flex-1 text-[15px]">{category}</span>
                  <span className="text-sm text-muted-foreground">{currency}</span>
                  <input
                    aria-label={`${category} budget`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={categoryValues[category] ?? ""}
                    onChange={(event) =>
                      setCategoryValues((current) => ({
                        ...current,
                        [category]: event.target.value,
                      }))
                    }
                    className="h-9 w-24 bg-transparent text-right text-base outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" size="lg">
            Save budgets
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
