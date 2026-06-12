"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type {
  Account,
  Expense,
  RecurringExpense,
  Space,
  Subscription,
  Group,
} from "@/lib/domain/types";
import { ActionSheet } from "./action-sheet";
import { AccountSheet } from "./account-sheet";
import { BudgetSheet } from "./budget-sheet";
import { ExpenseSheet } from "./expense-sheet";
import { GroupExpenseSheet } from "./group-expense-sheet";
import { GroupSheet } from "./group-sheet";
import { RecurringSheet } from "./recurring-sheet";
import { SearchSheet } from "./search-sheet";
import { SpaceSheet } from "./space-sheet";
import { SubscriptionSheet } from "./subscription-sheet";
import { TransferSheet } from "./transfer-sheet";

type ActiveSheet =
  | { kind: "actions" }
  | { kind: "expense"; expense?: Expense; defaults?: Partial<Expense> }
  | { kind: "recurring"; recurring?: RecurringExpense }
  | { kind: "group-expense"; groupId: string }
  | { kind: "budget" }
  | { kind: "search" }
  | { kind: "space"; space?: Space }
  | { kind: "account"; account?: Account }
  | { kind: "subscription"; subscription?: Subscription }
  | null;

interface SheetApi {
  openActions: () => void;
  openExpense: (expense?: Expense, defaults?: Partial<Expense>) => void;
  openRecurring: (recurring?: RecurringExpense) => void;
  openGroup: (group?: Group) => void;
  openGroupExpense: (groupId: string) => void;
  openBudget: () => void;
  openSearch: () => void;
  openSpace: (space?: Space) => void;
  openAccount: (account?: Account) => void;
  openSubscription: (subscription?: Subscription) => void;
  openTransfer: () => void;
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
  const [group, setGroup] = useState<{ open: boolean; data?: Group }>({
    open: false,
  });
  const [transfer, setTransfer] = useState<{ open: boolean }>({ open: false });

  const closeSheet = useCallback(() => {
    setActive(null);
    setGroup((prev) => ({ ...prev, open: false }));
    setTransfer((prev) => ({ ...prev, open: false }));
  }, []);

  const api = useMemo<SheetApi>(
    () => ({
      openActions: () => setActive({ kind: "actions" }),
      openExpense: (expense, defaults) =>
        setActive({ kind: "expense", expense, defaults }),
      openRecurring: (recurring) => setActive({ kind: "recurring", recurring }),
      openGroup: (data) => setGroup({ open: true, data }),
      openGroupExpense: (groupId) => setActive({ kind: "group-expense", groupId }),
      openBudget: () => setActive({ kind: "budget" }),
      openSearch: () => setActive({ kind: "search" }),
      openSpace: (space) => setActive({ kind: "space", space }),
      openAccount: (account) => setActive({ kind: "account", account }),
      openSubscription: (subscription) =>
        setActive({ kind: "subscription", subscription }),
      openTransfer: () => setTransfer({ open: true }),
      closeSheet,
    }),
    [closeSheet],
  );

  return (
    <SheetContext.Provider value={api}>
      {children}
      <ActionSheet open={active?.kind === "actions"} onClose={closeSheet} />
      <ExpenseSheet
        open={active?.kind === "expense"}
        expense={active?.kind === "expense" ? active.expense : undefined}
        defaults={active?.kind === "expense" ? active.defaults : undefined}
        onClose={closeSheet}
      />
      <RecurringSheet
        open={active?.kind === "recurring"}
        recurring={active?.kind === "recurring" ? active.recurring : undefined}
        onClose={closeSheet}
      />
      <GroupSheet
        open={group.open}
        onClose={() => setGroup((prev) => ({ ...prev, open: false }))}
      />
      <GroupExpenseSheet
        open={active?.kind === "group-expense"}
        groupId={active?.kind === "group-expense" ? active.groupId : null}
        onClose={closeSheet}
      />
      <BudgetSheet open={active?.kind === "budget"} onClose={closeSheet} />
      <SearchSheet open={active?.kind === "search"} onClose={closeSheet} />
      <SpaceSheet
        open={active?.kind === "space"}
        space={active?.kind === "space" ? active.space : undefined}
        onClose={closeSheet}
      />
      <AccountSheet
        open={active?.kind === "account"}
        account={active?.kind === "account" ? active.account : undefined}
        onClose={closeSheet}
      />
      <SubscriptionSheet
        open={active?.kind === "subscription"}
        subscription={
          active?.kind === "subscription" ? active.subscription : undefined
        }
        onClose={closeSheet}
      />
      <TransferSheet
        open={transfer.open}
        onClose={() => setTransfer((prev) => ({ ...prev, open: false }))}
      />
    </SheetContext.Provider>
  );
}
