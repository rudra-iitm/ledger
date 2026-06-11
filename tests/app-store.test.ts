import { beforeEach, describe, expect, it } from "vitest";
import { currentMonth } from "@/lib/domain/dates";
import { useAppStore } from "@/lib/store/app-store";

async function signInLocal() {
  await useAppStore.getState().signIn({
    provider: "local",
    user: { name: "Tester", avatarUrl: "" },
  });
}

async function flushWrites() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("app store with local storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAppStore.getState().signOut();
  });

  it("adds, edits, and deletes expenses with persistence", async () => {
    await signInLocal();
    const store = useAppStore.getState();

    store.addExpense({
      description: "lunch",
      amount: 450,
      category: "Food",
      date: "2026-06-10",
    });
    const added = useAppStore.getState().data.expenses[0];
    expect(added).toMatchObject({ description: "lunch", amount: 450 });

    useAppStore.getState().updateExpense(added.id, { amount: 500 });
    expect(useAppStore.getState().data.expenses[0].amount).toBe(500);

    await flushWrites();
    const persisted = JSON.parse(
      window.localStorage.getItem("ledger:data:expenses") ?? "[]",
    ) as Array<{ amount: number }>;
    expect(persisted[0].amount).toBe(500);

    useAppStore.getState().deleteExpense(added.id);
    expect(useAppStore.getState().data.expenses).toEqual([]);
  });

  it("restores data across sessions", async () => {
    await signInLocal();
    useAppStore.getState().setMonthlyBudget(30000);
    await flushWrites();

    useAppStore.getState().signOut();
    expect(useAppStore.getState().data.budgets.monthlyBudget).toBe(0);

    await signInLocal();
    expect(useAppStore.getState().data.budgets.monthlyBudget).toBe(30000);
  });

  it("manages groups and group expenses", async () => {
    await signInLocal();
    useAppStore.getState().addGroup("Trip", ["You", "Sam"]);

    const group = useAppStore.getState().data.groups[0];
    expect(group.members).toHaveLength(2);

    useAppStore.getState().addMember(group.id, "Priya");
    useAppStore.getState().addGroupExpense(group.id, {
      description: "Dinner",
      amount: 900,
      paidBy: group.members[0].id,
      splitAmong: group.members.map((member) => member.id),
      date: "2026-06-10",
    });

    const updated = useAppStore.getState().data.groups[0];
    expect(updated.members).toHaveLength(3);
    expect(updated.expenses).toHaveLength(1);

    useAppStore.getState().deleteGroupExpense(group.id, updated.expenses[0].id);
    expect(useAppStore.getState().data.groups[0].expenses).toEqual([]);
  });

  it("materializes a due recurring expense immediately when added", async () => {
    await signInLocal();
    useAppStore.getState().addRecurring({
      description: "Rent",
      amount: 15000,
      category: "Bills",
      dayOfMonth: 1,
      startMonth: currentMonth(),
      active: true,
    });

    const { expenses } = useAppStore.getState().data;
    expect(expenses).toHaveLength(1);
    expect(expenses[0]).toMatchObject({ description: "Rent", amount: 15000 });
  });

  it("materializes due recurring expenses on sign-in", async () => {
    await signInLocal();
    useAppStore.getState().addRecurring({
      description: "Internet",
      amount: 799,
      category: "Bills",
      dayOfMonth: 1,
      startMonth: "2026-05",
      active: true,
    });
    await flushWrites();

    useAppStore.getState().signOut();
    await signInLocal();

    const { expenses, recurring } = useAppStore.getState().data;
    const materialized = expenses.filter(
      (expense) => expense.recurringId === recurring[0].id,
    );
    expect(materialized.length).toBeGreaterThanOrEqual(2);
    expect(recurring[0].lastMaterializedMonth).toBeDefined();
  });
});
