"use client";

import { create } from "zustand";
import type { AuthSession } from "../auth/types";
import { clearSession, loadSession, saveSession } from "../auth/session";
import type { DataFile } from "../storage/adapter";
import { GitHubStorageAdapter } from "../storage/github";
import { LocalStorageAdapter } from "../storage/local";
import {
  EMPTY_DATA,
  LedgerRepository,
  type LedgerData,
} from "../storage/repository";
import { materializeRecurring } from "../domain/recurring";
import type {
  Budgets,
  Expense,
  Group,
  GroupExpense,
  Member,
  RecurringExpense,
  Settings,
} from "../domain/types";
import { createId } from "../domain/id";

export type AppStatus = "booting" | "unauthenticated" | "loading" | "ready";
export type SyncStatus = "synced" | "saving" | "error";

interface AppState {
  status: AppStatus;
  session: AuthSession | null;
  data: LedgerData;
  syncStatus: SyncStatus;
  initialize: () => Promise<void>;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => void;
  addExpense: (expense: Omit<Expense, "id" | "createdAt">) => void;
  updateExpense: (id: string, patch: Partial<Omit<Expense, "id">>) => void;
  deleteExpense: (id: string) => void;
  setMonthlyBudget: (amount: number) => void;
  addRecurring: (
    item: Omit<RecurringExpense, "id" | "createdAt" | "lastMaterializedMonth">,
  ) => void;
  updateRecurring: (
    id: string,
    patch: Partial<Omit<RecurringExpense, "id">>,
  ) => void;
  deleteRecurring: (id: string) => void;
  addGroup: (name: string, memberNames: string[]) => void;
  deleteGroup: (id: string) => void;
  addMember: (groupId: string, name: string) => void;
  addGroupExpense: (
    groupId: string,
    expense: Omit<GroupExpense, "id" | "createdAt">,
  ) => void;
  deleteGroupExpense: (groupId: string, expenseId: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

let repository: LedgerRepository | null = null;

function buildRepository(session: AuthSession): LedgerRepository {
  const adapter = session.githubToken
    ? new GitHubStorageAdapter(session.githubToken)
    : new LocalStorageAdapter();
  return new LedgerRepository(adapter);
}

const pendingWrites = new Map<DataFile, Promise<void>>();

function persist(file: DataFile, data: LedgerData, set: SetState): void {
  const repo = repository;
  if (!repo) return;
  const payload = data[file];
  const previous = pendingWrites.get(file) ?? Promise.resolve();
  const next = previous
    .then(() => repo.save(file, payload))
    .then(() => {
      if (pendingWrites.get(file) === next) pendingWrites.delete(file);
      if (pendingWrites.size === 0) set({ syncStatus: "synced" });
    })
    .catch(() => {
      if (pendingWrites.get(file) === next) pendingWrites.delete(file);
      set({ syncStatus: "error" });
    });
  pendingWrites.set(file, next);
  set({ syncStatus: "saving" });
}

type SetState = (partial: Partial<AppState>) => void;

export const useAppStore = create<AppState>((set, get) => {
  const mutate = <K extends DataFile>(
    file: K,
    updater: (data: LedgerData) => LedgerData[K],
  ): void => {
    const data = { ...get().data, [file]: updater(get().data) };
    set({ data });
    persist(file, data, set);
  };

  const materializeNow = (): void => {
    const { newExpenses, updatedRecurring, changed } = materializeRecurring(
      get().data.recurring,
    );
    if (!changed) return;
    const data: LedgerData = {
      ...get().data,
      expenses: [...newExpenses, ...get().data.expenses],
      recurring: updatedRecurring,
    };
    set({ data });
    persist("expenses", data, set);
    persist("recurring", data, set);
  };

  const loadData = async (session: AuthSession): Promise<void> => {
    set({ status: "loading" });
    repository = buildRepository(session);
    const loaded = await repository.loadAll();
    const { newExpenses, updatedRecurring, changed } = materializeRecurring(
      loaded.recurring,
    );
    const data: LedgerData = changed
      ? {
          ...loaded,
          expenses: [...loaded.expenses, ...newExpenses],
          recurring: updatedRecurring,
        }
      : loaded;
    set({ data, status: "ready", syncStatus: "synced" });
    if (changed) {
      persist("expenses", data, set);
      persist("recurring", data, set);
    }
  };

  return {
    status: "booting",
    session: null,
    data: EMPTY_DATA,
    syncStatus: "synced",

    initialize: async () => {
      const session = loadSession();
      if (!session) {
        set({ status: "unauthenticated" });
        return;
      }
      set({ session });
      try {
        await loadData(session);
      } catch {
        clearSession();
        repository = null;
        set({ status: "unauthenticated", session: null });
      }
    },

    signIn: async (session) => {
      saveSession(session);
      set({ session });
      await loadData(session);
    },

    signOut: () => {
      clearSession();
      repository = null;
      pendingWrites.clear();
      set({
        session: null,
        status: "unauthenticated",
        data: EMPTY_DATA,
        syncStatus: "synced",
      });
    },

    addExpense: (expense) =>
      mutate("expenses", ({ expenses }) => [
        { ...expense, id: createId(), createdAt: new Date().toISOString() },
        ...expenses,
      ]),

    updateExpense: (id, patch) =>
      mutate("expenses", ({ expenses }) =>
        expenses.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      ),

    deleteExpense: (id) =>
      mutate("expenses", ({ expenses }) =>
        expenses.filter((item) => item.id !== id),
      ),

    setMonthlyBudget: (amount) =>
      mutate("budgets", (): Budgets => ({ monthlyBudget: amount })),

    addRecurring: (item) => {
      mutate("recurring", ({ recurring }) => [
        ...recurring,
        { ...item, id: createId(), createdAt: new Date().toISOString() },
      ]);
      materializeNow();
    },

    updateRecurring: (id, patch) => {
      mutate("recurring", ({ recurring }) =>
        recurring.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      );
      materializeNow();
    },

    deleteRecurring: (id) =>
      mutate("recurring", ({ recurring }) =>
        recurring.filter((item) => item.id !== id),
      ),

    addGroup: (name, memberNames) =>
      mutate("groups", ({ groups }) => [
        ...groups,
        {
          id: createId(),
          name,
          members: memberNames.map(
            (memberName): Member => ({ id: createId(), name: memberName }),
          ),
          expenses: [],
          createdAt: new Date().toISOString(),
        },
      ]),

    deleteGroup: (id) =>
      mutate("groups", ({ groups }) =>
        groups.filter((group) => group.id !== id),
      ),

    addMember: (groupId, name) =>
      mutate("groups", ({ groups }) =>
        groups.map(
          (group): Group =>
            group.id === groupId
              ? {
                  ...group,
                  members: [...group.members, { id: createId(), name }],
                }
              : group,
        ),
      ),

    addGroupExpense: (groupId, expense) =>
      mutate("groups", ({ groups }) =>
        groups.map(
          (group): Group =>
            group.id === groupId
              ? {
                  ...group,
                  expenses: [
                    {
                      ...expense,
                      id: createId(),
                      createdAt: new Date().toISOString(),
                    },
                    ...group.expenses,
                  ],
                }
              : group,
        ),
      ),

    deleteGroupExpense: (groupId, expenseId) =>
      mutate("groups", ({ groups }) =>
        groups.map(
          (group): Group =>
            group.id === groupId
              ? {
                  ...group,
                  expenses: group.expenses.filter(
                    (item) => item.id !== expenseId,
                  ),
                }
              : group,
        ),
      ),

    updateSettings: (patch) =>
      mutate("settings", ({ settings }) => ({ ...settings, ...patch })),
  };
});
