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
import {
  type AttachmentBlob,
  type AttachmentStore,
  LocalAttachmentStore,
  fileToAttachmentBlob,
} from "../storage/attachments";
import { GitHubAttachmentStore } from "../storage/github-attachments";
import { materializeRecurring } from "../domain/recurring";
import { materializeSubscriptions } from "../domain/subscriptions";
import { materializeInvestments } from "../domain/recurring-investments";
import { recomputeBalances } from "../domain/balances";
import { roundMoney } from "../domain/money";
import type {
  Account,
  Attachment,
  Budgets,
  Category,
  Expense,
  Group,
  GroupExpense,
  Member,
  RecurringExpense,
  Settings,
  Space,
  Subscription,
  DebitCard,
  LendBorrow,
  LendBorrowRepayment,
  RecurringInvestment,
  Goal,
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
  addExpense: (
    expense: Omit<
      Expense,
      "id" | "createdAt" | "tags" | "attachments" | "affectsBalance"
    > &
      Partial<Pick<Expense, "tags" | "attachments" | "affectsBalance">>,
  ) => string;
  addIncome: (
    income: Omit<
      Expense,
      "id" | "createdAt" | "tags" | "attachments" | "affectsBalance" | "type"
    > &
      Partial<Pick<Expense, "tags" | "attachments" | "affectsBalance">>,
  ) => string;
  updateExpense: (id: string, patch: Partial<Omit<Expense, "id">>) => void;
  deleteExpense: (id: string) => void;
  addAttachment: (expenseId: string, file: File) => Promise<void>;
  getAttachment: (
    attachmentId: string,
    mimeType?: string,
  ) => Promise<AttachmentBlob | null>;
  removeAttachment: (expenseId: string, attachmentId: string) => Promise<void>;
  setMonthlyBudget: (amount: number) => void;
  setCategoryBudget: (category: Category, amount: number | null) => void;
  addRecurring: (
    item: Omit<RecurringExpense, "id" | "createdAt" | "lastMaterializedDate">,
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
  addAccount: (
    account: Omit<Account, "id" | "createdAt" | "reconciliations">,
  ) => string;
  updateAccount: (id: string, patch: Partial<Omit<Account, "id">>) => void;
  deleteAccount: (id: string) => void;
  addSpace: (space: Omit<Space, "id" | "createdAt">) => string;
  updateSpace: (id: string, patch: Partial<Omit<Space, "id">>) => void;
  deleteSpace: (id: string) => void;
  addSubscription: (
    subscription: Omit<Subscription, "id" | "createdAt">,
  ) => void;
  updateSubscription: (
    id: string,
    patch: Partial<Omit<Subscription, "id">>,
  ) => void;
  deleteSubscription: (id: string) => void;
  addTag: (tag: string) => void;
  deleteTag: (tag: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  addTransfer: (
    sourceAccountId: string,
    destinationAccountId: string,
    amount: number,
    date: string,
    description: string,
    affectsBalance?: boolean,
  ) => void;
  addCreditCardPayment: (payment: {
    cardId: string;
    fromAccountId: string;
    amount: number;
    date: string;
    notes?: string;
  }) => void;
  addDebitCard: (accountId: string, card: Omit<DebitCard, "id">) => void;
  deleteDebitCard: (accountId: string, cardId: string) => void;
  addLendBorrow: (
    item: Omit<LendBorrow, "id" | "createdAt" | "repayments" | "attachments"> & { attachments?: Attachment[] },
  ) => string;
  updateLendBorrow: (id: string, patch: Partial<Omit<LendBorrow, "id">>) => void;
  deleteLendBorrow: (id: string) => void;
  addLendBorrowRepayment: (
    lendBorrowId: string,
    repayment: Omit<LendBorrowRepayment, "id" | "createdAt">,
  ) => void;
  deleteLendBorrowRepayment: (lendBorrowId: string, repaymentId: string) => void;
  addLendBorrowAttachment: (id: string, file: File) => Promise<void>;
  removeLendBorrowAttachment: (id: string, attachmentId: string) => Promise<void>;
  addInvestment: (payload: {
    name: string;
    fromAccountId: string;
    investmentAccountId: string;
    amount: number;
    units?: number;
    date: string;
    notes?: string;
    affectsBalance?: boolean;
  }) => void;
  addRecurringInvestment: (
    item: Omit<RecurringInvestment, "id" | "createdAt" | "lastMaterializedDate">,
  ) => void;
  updateRecurringInvestment: (
    id: string,
    patch: Partial<Omit<RecurringInvestment, "id">>,
  ) => void;
  deleteRecurringInvestment: (id: string) => void;
  addGoal: (goal: Omit<Goal, "id" | "createdAt">) => string;
  updateGoal: (id: string, patch: Partial<Omit<Goal, "id">>) => void;
  deleteGoal: (id: string) => void;
  reconcileAccount: (
    accountId: string,
    actualBalance: number,
    date: string,
    postAdjustment: boolean,
  ) => void;
}

let repository: LedgerRepository | null = null;
let attachmentStore: AttachmentStore | null = null;

function buildAdapters(session: AuthSession): {
  repository: LedgerRepository;
  attachments: AttachmentStore;
} {
  if (session.githubToken) {
    return {
      repository: new LedgerRepository(
        new GitHubStorageAdapter(session.githubToken),
      ),
      attachments: new GitHubAttachmentStore(session.githubToken),
    };
  }
  return {
    repository: new LedgerRepository(new LocalStorageAdapter()),
    attachments: new LocalAttachmentStore(),
  };
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

  const mutateLedger = (
    updater: (
      data: LedgerData,
    ) => Partial<Pick<LedgerData, "expenses" | "accounts">>,
  ): void => {
    const current = get().data;
    const patch = updater(current);
    const base: LedgerData = { ...current, ...patch };
    const accounts = recomputeBalances(base.accounts, base.expenses);
    const accountsChanged = accounts.some(
      (account, index) => account !== base.accounts[index],
    );
    const data: LedgerData = accountsChanged ? { ...base, accounts } : base;
    set({ data });
    if (patch.expenses) persist("expenses", data, set);
    if (patch.accounts || accountsChanged) persist("accounts", data, set);
  };

  const materializeNow = (): void => {
    const recurringResult = materializeRecurring(get().data.recurring);
    const subscriptionResult = materializeSubscriptions(get().data.subscriptions);
    const investmentResult = materializeInvestments(
      get().data.recurringInvestments,
    );
    if (
      !recurringResult.changed &&
      !subscriptionResult.changed &&
      !investmentResult.changed
    ) {
      return;
    }

    const merged: LedgerData = {
      ...get().data,
      expenses: [
        ...recurringResult.newExpenses,
        ...subscriptionResult.newExpenses,
        ...investmentResult.newExpenses,
        ...get().data.expenses,
      ],
      recurring: recurringResult.updatedRecurring,
      subscriptions: subscriptionResult.updatedSubscriptions,
      recurringInvestments: investmentResult.updatedRecurring,
    };
    const data: LedgerData = {
      ...merged,
      accounts: recomputeBalances(merged.accounts, merged.expenses),
    };
    set({ data });
    if (recurringResult.changed) {
      persist("expenses", data, set);
      persist("recurring", data, set);
    }
    if (subscriptionResult.changed) {
      persist("expenses", data, set);
      persist("subscriptions", data, set);
    }
    if (investmentResult.changed) {
      persist("expenses", data, set);
      persist("recurringInvestments", data, set);
    }
    persist("accounts", data, set);
  };

  const loadData = async (session: AuthSession): Promise<void> => {
    set({ status: "loading" });
    const adapters = buildAdapters(session);
    repository = adapters.repository;
    attachmentStore = adapters.attachments;
    const loaded = await repository.loadAll();
    const recurringResult = materializeRecurring(loaded.recurring);
    const subscriptionResult = materializeSubscriptions(loaded.subscriptions);
    const investmentResult = materializeInvestments(loaded.recurringInvestments);

    const merged: LedgerData = {
      ...loaded,
      expenses: [
        ...recurringResult.newExpenses,
        ...subscriptionResult.newExpenses,
        ...investmentResult.newExpenses,
        ...loaded.expenses,
      ],
      recurring: recurringResult.updatedRecurring,
      subscriptions: subscriptionResult.updatedSubscriptions,
      recurringInvestments: investmentResult.updatedRecurring,
    };
    const recomputed = recomputeBalances(merged.accounts, merged.expenses);
    const accountsChanged = recomputed.some(
      (account, index) => account !== merged.accounts[index],
    );
    const data: LedgerData = accountsChanged
      ? { ...merged, accounts: recomputed }
      : merged;
    set({ data, status: "ready", syncStatus: "synced" });
    if (recurringResult.changed) {
      persist("expenses", data, set);
      persist("recurring", data, set);
    }
    if (subscriptionResult.changed) {
      persist("expenses", data, set);
      persist("subscriptions", data, set);
    }
    if (investmentResult.changed) {
      persist("expenses", data, set);
      persist("recurringInvestments", data, set);
    }
    if (accountsChanged) persist("accounts", data, set);
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
        attachmentStore = null;
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
      attachmentStore = null;
      pendingWrites.clear();
      set({
        session: null,
        status: "unauthenticated",
        data: EMPTY_DATA,
        syncStatus: "synced",
      });
    },

    addExpense: (expense) => {
      const id = createId();
      mutateLedger(({ expenses }) => ({
        expenses: [
          {
            tags: [],
            attachments: [],
            affectsBalance: true,
            ...expense,
            id,
            createdAt: new Date().toISOString(),
          },
          ...expenses,
        ],
      }));
      return id;
    },

    addIncome: (income) => {
      const id = createId();
      mutateLedger(({ expenses }) => ({
        expenses: [
          {
            tags: [],
            attachments: [],
            affectsBalance: true,
            ...income,
            type: "income" as const,
            id,
            createdAt: new Date().toISOString(),
          },
          ...expenses,
        ],
      }));
      return id;
    },

    updateExpense: (id, patch) => {
      const current = get().data.expenses.find((item) => item.id === id);
      const now = new Date().toISOString();
      const tracked: (keyof Expense)[] = [
        "amount",
        "category",
        "date",
        "description",
        "accountId",
        "type",
        "incomeCategory",
        "source",
        "affectsBalance",
        "notes",
      ];
      const changes = current
        ? tracked
            .filter((field) => field in patch)
            .map((field) => ({
              field,
              from: String(current[field] ?? ""),
              to: String((patch as Record<string, unknown>)[field] ?? ""),
            }))
            .filter((change) => change.from !== change.to)
            .map((change) => ({ at: now, ...change }))
        : [];
      mutateLedger(({ expenses }) => ({
        expenses: expenses.map((item) =>
          item.id === id
            ? {
                ...item,
                ...patch,
                updatedAt: changes.length ? now : item.updatedAt,
                history: changes.length
                  ? [...changes, ...(item.history ?? [])].slice(0, 30)
                  : item.history,
              }
            : item,
        ),
      }));
    },

    deleteExpense: (id) => {
      const target = get().data.expenses.find((item) => item.id === id);
      if (target && attachmentStore) {
        const store = attachmentStore;
        for (const attachment of target.attachments) {
          void store.remove(attachment.id, attachment.mimeType);
        }
      }
      mutateLedger(({ expenses }) => ({
        expenses: expenses.filter((item) => item.id !== id),
      }));
    },

    addAttachment: async (expenseId, file) => {
      if (!attachmentStore) return;
      const blob = await fileToAttachmentBlob(file);
      const attachment: Attachment = {
        id: createId(),
        name: file.name,
        mimeType: blob.mimeType,
        size: file.size,
        createdAt: new Date().toISOString(),
      };
      await attachmentStore.put(attachment.id, blob);
      mutate("expenses", ({ expenses }) =>
        expenses.map((item) =>
          item.id === expenseId
            ? { ...item, attachments: [...item.attachments, attachment] }
            : item,
        ),
      );
    },

    getAttachment: async (attachmentId, mimeType) => {
      if (!attachmentStore) return null;
      return attachmentStore.get(attachmentId, mimeType);
    },

    removeAttachment: async (expenseId, attachmentId) => {
      if (attachmentStore) {
        const meta = get()
          .data.expenses.find((item) => item.id === expenseId)
          ?.attachments.find((attachment) => attachment.id === attachmentId);
        await attachmentStore.remove(attachmentId, meta?.mimeType);
      }
      mutate("expenses", ({ expenses }) =>
        expenses.map((item) =>
          item.id === expenseId
            ? {
                ...item,
                attachments: item.attachments.filter(
                  (attachment) => attachment.id !== attachmentId,
                ),
              }
            : item,
        ),
      );
    },

    setMonthlyBudget: (amount) =>
      mutate(
        "budgets",
        ({ budgets }): Budgets => ({ ...budgets, monthlyBudget: amount }),
      ),

    setCategoryBudget: (category, amount) =>
      mutate("budgets", ({ budgets }): Budgets => {
        const categoryBudgets = { ...budgets.categoryBudgets };
        if (amount === null || amount <= 0) delete categoryBudgets[category];
        else categoryBudgets[category] = amount;
        return { ...budgets, categoryBudgets };
      }),

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

    addAccount: (account) => {
      const id = createId();
      mutateLedger(({ accounts }) => ({
        accounts: [
          ...accounts,
          {
            ...account,
            reconciliations: [],
            id,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      return id;
    },

    updateAccount: (id, patch) =>
      mutateLedger(({ accounts }) => ({
        accounts: accounts.map((account) =>
          account.id === id ? { ...account, ...patch } : account,
        ),
      })),

    deleteAccount: (id) =>
      mutateLedger(({ accounts }) => ({
        accounts: accounts.filter((account) => account.id !== id),
      })),

    addSpace: (space) => {
      const id = createId();
      mutate("spaces", ({ spaces }) => [
        ...spaces,
        { ...space, id, createdAt: new Date().toISOString() },
      ]);
      return id;
    },

    updateSpace: (id, patch) =>
      mutate("spaces", ({ spaces }) =>
        spaces.map((space) => (space.id === id ? { ...space, ...patch } : space)),
      ),

    deleteSpace: (id) => {
      mutate("spaces", ({ spaces }) => spaces.filter((space) => space.id !== id));
      mutate("expenses", ({ expenses }) =>
        expenses.map((expense) =>
          expense.spaceId === id ? { ...expense, spaceId: undefined } : expense,
        ),
      );
    },

    addSubscription: (subscription) => {
      mutate("subscriptions", ({ subscriptions }) => [
        ...subscriptions,
        { ...subscription, id: createId(), createdAt: new Date().toISOString() },
      ]);
      materializeNow();
    },

    updateSubscription: (id, patch) => {
      mutate("subscriptions", ({ subscriptions }) =>
        subscriptions.map((subscription) =>
          subscription.id === id ? { ...subscription, ...patch } : subscription,
        ),
      );
      materializeNow();
    },

    deleteSubscription: (id) =>
      mutate("subscriptions", ({ subscriptions }) =>
        subscriptions.filter((subscription) => subscription.id !== id),
      ),

    addTag: (tag) =>
      mutate("settings", ({ settings }) =>
        settings.tags.includes(tag)
          ? settings
          : { ...settings, tags: [...settings.tags, tag] },
      ),

    deleteTag: (tag) =>
      mutate("settings", ({ settings }) => ({
        ...settings,
        tags: settings.tags.filter((item) => item !== tag),
      })),

    updateSettings: (patch) =>
      mutate("settings", ({ settings }) => ({ ...settings, ...patch })),

    addTransfer: (
      sourceAccountId,
      destinationAccountId,
      amount,
      date,
      description,
      affectsBalance = true,
    ) => {
      const id = createId();
      mutateLedger(({ expenses }) => ({
        expenses: [
          {
            id,
            type: "transfer" as const,
            description,
            amount,
            category: "Other",
            date,
            accountId: sourceAccountId,
            transferAccountId: destinationAccountId,
            affectsBalance,
            tags: [],
            attachments: [],
            createdAt: new Date().toISOString(),
          },
          ...expenses,
        ],
      }));
    },

    addCreditCardPayment: ({ cardId, fromAccountId, amount, date, notes }) => {
      const id = createId();
      const card = get().data.accounts.find((acc) => acc.id === cardId);
      mutateLedger(({ expenses }) => ({
        expenses: [
          {
            id,
            type: "cc_payment" as const,
            description: card ? `Payment · ${card.name}` : "Card payment",
            amount,
            category: "Bills" as const,
            date,
            accountId: fromAccountId,
            paymentTargetId: cardId,
            affectsBalance: true,
            notes: notes?.trim() || undefined,
            tags: [],
            attachments: [],
            createdAt: new Date().toISOString(),
          },
          ...expenses,
        ],
      }));
    },

    addDebitCard: (accountId, card) => {
      const id = createId();
      mutate("accounts", ({ accounts }) =>
        accounts.map((acc) =>
          acc.id === accountId
            ? { ...acc, debitCards: [...acc.debitCards, { ...card, id }] }
            : acc
        )
      );
    },

    deleteDebitCard: (accountId, cardId) => {
      mutate("accounts", ({ accounts }) =>
        accounts.map((acc) =>
          acc.id === accountId
            ? { ...acc, debitCards: acc.debitCards.filter((c) => c.id !== cardId) }
            : acc
        )
      );
    },

    addLendBorrow: (item) => {
      const id = createId();
      mutate("lendBorrows", ({ lendBorrows }) => [
        {
          ...item,
          id,
          repayments: [],
          attachments: [],
          createdAt: new Date().toISOString(),
        },
        ...lendBorrows,
      ]);
      return id;
    },

    updateLendBorrow: (id, patch) =>
      mutate("lendBorrows", ({ lendBorrows }) =>
        lendBorrows.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      ),

    deleteLendBorrow: (id) => {
      const target = get().data.lendBorrows.find((item) => item.id === id);
      if (target && attachmentStore) {
        const store = attachmentStore;
        for (const attachment of target.attachments) {
          void store.remove(attachment.id, attachment.mimeType);
        }
      }
      mutate("lendBorrows", ({ lendBorrows }) =>
        lendBorrows.filter((item) => item.id !== id),
      );
    },

    addLendBorrowRepayment: (lendBorrowId, repayment) => {
      mutate("lendBorrows", ({ lendBorrows }) =>
        lendBorrows.map((item) =>
          item.id === lendBorrowId
            ? {
                ...item,
                repayments: [
                  ...item.repayments,
                  {
                    ...repayment,
                    id: createId(),
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : item,
        ),
      );
    },

    deleteLendBorrowRepayment: (lendBorrowId, repaymentId) => {
      mutate("lendBorrows", ({ lendBorrows }) =>
        lendBorrows.map((item) =>
          item.id === lendBorrowId
            ? {
                ...item,
                repayments: item.repayments.filter(
                  (rep) => rep.id !== repaymentId,
                ),
              }
            : item,
        ),
      );
    },

    addLendBorrowAttachment: async (id, file) => {
      if (!attachmentStore) return;
      const blob = await fileToAttachmentBlob(file);
      const attachment: Attachment = {
        id: createId(),
        name: file.name,
        mimeType: blob.mimeType,
        size: file.size,
        createdAt: new Date().toISOString(),
      };
      await attachmentStore.put(attachment.id, blob);
      mutate("lendBorrows", ({ lendBorrows }) =>
        lendBorrows.map((item) =>
          item.id === id
            ? { ...item, attachments: [...item.attachments, attachment] }
            : item,
        ),
      );
    },

    removeLendBorrowAttachment: async (id, attachmentId) => {
      if (attachmentStore) {
        const meta = get()
          .data.lendBorrows.find((item) => item.id === id)
          ?.attachments.find((attachment) => attachment.id === attachmentId);
        await attachmentStore.remove(attachmentId, meta?.mimeType);
      }
      mutate("lendBorrows", ({ lendBorrows }) =>
        lendBorrows.map((item) =>
          item.id === id
            ? {
                ...item,
                attachments: item.attachments.filter(
                  (attachment) => attachment.id !== attachmentId,
                ),
              }
            : item,
        ),
      );
    },

    addInvestment: ({
      name,
      fromAccountId,
      investmentAccountId,
      amount,
      units,
      date,
      notes,
      affectsBalance = true,
    }) => {
      const id = createId();
      mutateLedger(({ expenses }) => ({
        expenses: [
          {
            id,
            type: "investment" as const,
            description: name,
            amount,
            category: "Investments" as const,
            date,
            accountId: fromAccountId,
            transferAccountId: investmentAccountId,
            units,
            affectsBalance,
            notes: notes?.trim() || undefined,
            tags: [],
            attachments: [],
            createdAt: new Date().toISOString(),
          },
          ...expenses,
        ],
      }));
    },

    addRecurringInvestment: (item) => {
      mutate("recurringInvestments", ({ recurringInvestments }) => [
        ...recurringInvestments,
        { ...item, id: createId(), createdAt: new Date().toISOString() },
      ]);
      materializeNow();
    },

    updateRecurringInvestment: (id, patch) => {
      mutate("recurringInvestments", ({ recurringInvestments }) =>
        recurringInvestments.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      );
      materializeNow();
    },

    deleteRecurringInvestment: (id) =>
      mutate("recurringInvestments", ({ recurringInvestments }) =>
        recurringInvestments.filter((item) => item.id !== id),
      ),

    addGoal: (goal) => {
      const id = createId();
      mutate("goals", ({ goals }) => [
        ...goals,
        { ...goal, id, createdAt: new Date().toISOString() },
      ]);
      return id;
    },

    updateGoal: (id, patch) =>
      mutate("goals", ({ goals }) =>
        goals.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)),
      ),

    deleteGoal: (id) =>
      mutate("goals", ({ goals }) => goals.filter((goal) => goal.id !== id)),

    reconcileAccount: (accountId, actualBalance, date, postAdjustment) => {
      const account = get().data.accounts.find((a) => a.id === accountId);
      if (!account) return;
      const appBalance = account.balance;
      const difference = roundMoney(actualBalance - appBalance);
      const willAdjust =
        postAdjustment && difference !== 0 && account.type !== "credit_card";
      const record = {
        id: createId(),
        date,
        actualBalance,
        appBalance,
        difference,
        adjusted: willAdjust,
        createdAt: new Date().toISOString(),
      };
      mutateLedger(({ expenses, accounts }) => {
        const nextAccounts = accounts.map((a) =>
          a.id === accountId
            ? {
                ...a,
                reconciledBalance: actualBalance,
                reconciledDate: date,
                reconciliations: [record, ...a.reconciliations],
              }
            : a,
        );
        if (!willAdjust) return { accounts: nextAccounts };
        const isIncome = difference > 0;
        const adjustment: Expense = {
          id: createId(),
          type: isIncome ? "income" : "expense",
          description: "Reconciliation adjustment",
          amount: Math.abs(difference),
          category: "Other",
          incomeCategory: isIncome ? "Other" : undefined,
          date,
          accountId,
          affectsBalance: true,
          tags: [],
          attachments: [],
          createdAt: new Date().toISOString(),
        };
        return { accounts: nextAccounts, expenses: [adjustment, ...expenses] };
      });
    },
  };
});
