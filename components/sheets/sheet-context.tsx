"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Expense, RecurringExpense } from "@/lib/domain/types";
import { ActionSheet } from "./action-sheet";
import { BudgetSheet } from "./budget-sheet";
import { ExpenseSheet } from "./expense-sheet";
import { GroupExpenseSheet } from "./group-expense-sheet";
import { GroupSheet } from "./group-sheet";
import { RecurringSheet } from "./recurring-sheet";

type ActiveSheet =
  | { kind: "actions" }
  | { kind: "expense"; expense?: Expense }
  | { kind: "recurring"; recurring?: RecurringExpense }
  | { kind: "group" }
  | { kind: "group-expense"; groupId: string }
  | { kind: "budget" }
  | null;

interface SheetApi {
  openActions: () => void;
  openExpense: (expense?: Expense) => void;
  openRecurring: (recurring?: RecurringExpense) => void;
  openGroup: () => void;
  openGroupExpense: (groupId: string) => void;
  openBudget: () => void;
  closeSheet: () => void;
}

const SheetContext = createContext<SheetApi | null>(null);

export function useSheets(): SheetApi {
  const api = useContext(SheetContext);
  if (!api) throw new Error("useSheets must be used inside SheetProvider");
  return api;
}

export function SheetProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveSheet>(null);

  const closeSheet = useCallback(() => setActive(null), []);

  const api = useMemo<SheetApi>(
    () => ({
      openActions: () => setActive({ kind: "actions" }),
      openExpense: (expense) => setActive({ kind: "expense", expense }),
      openRecurring: (recurring) => setActive({ kind: "recurring", recurring }),
      openGroup: () => setActive({ kind: "group" }),
      openGroupExpense: (groupId) => setActive({ kind: "group-expense", groupId }),
      openBudget: () => setActive({ kind: "budget" }),
      closeSheet: () => setActive(null),
    }),
    [],
  );

  return (
    <SheetContext.Provider value={api}>
      {children}
      <ActionSheet open={active?.kind === "actions"} onClose={closeSheet} />
      <ExpenseSheet
        open={active?.kind === "expense"}
        expense={active?.kind === "expense" ? active.expense : undefined}
        onClose={closeSheet}
      />
      <RecurringSheet
        open={active?.kind === "recurring"}
        recurring={active?.kind === "recurring" ? active.recurring : undefined}
        onClose={closeSheet}
      />
      <GroupSheet open={active?.kind === "group"} onClose={closeSheet} />
      <GroupExpenseSheet
        open={active?.kind === "group-expense"}
        groupId={active?.kind === "group-expense" ? active.groupId : null}
        onClose={closeSheet}
      />
      <BudgetSheet open={active?.kind === "budget"} onClose={closeSheet} />
    </SheetContext.Provider>
  );
}
