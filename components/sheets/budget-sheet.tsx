"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAppStore } from "@/lib/store/app-store";

export function BudgetSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const monthlyBudget = useAppStore((state) => state.data.budgets.monthlyBudget);
  const setMonthlyBudget = useAppStore((state) => state.setMonthlyBudget);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue(monthlyBudget > 0 ? String(monthlyBudget) : "");
  }, [open, monthlyBudget]);

  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed >= 0 && value !== "";

  const submit = () => {
    if (!valid) return;
    setMonthlyBudget(parsed);
    toast.success("Budget updated");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Monthly budget</SheetTitle>
          <SheetDescription>
            One overall spending limit for each month.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-amount">Budget</Label>
            <Input
              id="budget-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="30000"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <Button type="submit" size="lg" disabled={!valid}>
            Save budget
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
