"use client";

import { create } from "zustand";
import { toast } from "sonner";
import type { AuthSession } from "../auth/types";
import { clearSession, loadSession, saveSession } from "../auth/session";
import { DATA_FILES, type DataFile } from "../storage/adapter";
import { buildBackup, parseBackup } from "../export/backup";
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
import { buildSnapshot, upsertSnapshot } from "../domain/snapshots";
import { materializeSubscriptions } from "../domain/subscriptions";
import { materializeInvestments } from "../domain/recurring-investments";
import { recomputeBalances } from "../domain/balances";
import { buildPriceParams, priceUpdates } from "../domain/prices";
import {
  createRemoteGroup,
  fetchRemoteGroup,
  joinRemoteGroup,
  mergeSharedIntoLocal,
  pushRemoteGroup,
  sharedToLocal,
} from "../groups/sync";
import { roundMoney } from "../domain/money";
import type {
  Account,
  Attachment,
  Budgets,
  Category,
  Expense,
  Group,
  GroupExpense,
  GroupSettlement,
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
  DraftTransaction,
  ImportBatch,
  Rule,
} from "../domain/types";
import { createId } from "../domain/id";
import type { StatementRow } from "../domain/ingest/csv";
import { draftToExpense, runImportPipeline } from "../domain/ingest/pipeline";
import {
  suggestionTarget,
  suggestionToRecurring,
  suggestionToSubscription,
  type RecurringSuggestion,
} from "../domain/ingest/recurrence";
import { resolveBrand } from "../brands/registry";

export type AppStatus =
  | "booting"
  | "unauthenticated"
  | "loading"
  | "ready"
  | "offline";
export type SyncStatus = "synced" | "saving" | "error";

interface AppState {
  status: AppStatus;
  session: AuthSession | null;
  data: LedgerData;
  syncStatus: SyncStatus;
  initialize: () => Promise<void>;
  retryInitialize: () => Promise<void>;
  retrySync: () => void;
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
  recordGroupSettlement: (
    groupId: string,
    settlement: Omit<GroupSettlement, "id" | "createdAt">,
  ) => void;
  deleteGroupSettlement: (groupId: string, settlementId: string) => void;
  shareGroup: (groupId: string) => Promise<boolean>;
  syncGroup: (groupId: string) => Promise<void>;
  joinGroup: (remoteId: string, displayName: string) => Promise<string | null>;
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
  adjustBalance: (
    accountId: string,
    newBalance: number,
    date: string,
    hardReset?: boolean,
  ) => void;
  exportBackup: () => string;
  importBackup: (json: string) => Promise<void>;
  refreshPrices: () => Promise<void>;
  importStatement: (
    accountId: string,
    fileName: string,
    rows: StatementRow[],
  ) => ImportBatch;
  updateDraft: (
    id: string,
    patch: Partial<Omit<DraftTransaction, "id" | "batchId" | "lineHash">>,
  ) => void;
  confirmDraft: (id: string) => void;
  confirmPendingDrafts: () => number;
  rejectDraft: (id: string) => void;
  resolveDraftDuplicate: (id: string, action: "merge" | "keep") => void;
  addRule: (rule: Omit<Rule, "id" | "createdAt">) => void;
  updateRule: (id: string, patch: Partial<Omit<Rule, "id">>) => void;
  deleteRule: (id: string) => void;
  trackSuggestion: (suggestion: RecurringSuggestion) => void;
  dismissSuggestion: (key: string) => void;
}

function pricesEndpoint(): string | null {
  const explicit = process.env.NEXT_PUBLIC_PRICES_URL;
  if (explicit) return explicit;
  const exchange = process.env.NEXT_PUBLIC_GITHUB_TOKEN_EXCHANGE_URL;
  if (!exchange) return null;
  try {
    return new URL("/prices", exchange).toString();
  } catch {
    return null;
  }
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
/** Files whose last write failed — retried via retrySync / the online event. */
const failedFiles = new Set<DataFile>();
/** Files whose stored content failed validation on load — never overwritten. */
const protectedFiles = new Set<DataFile>();

function isAuthError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === 401
  );
}

function persist(file: DataFile, data: LedgerData, set: SetState): void {
  const repo = repository;
  if (!repo) return;
  if (protectedFiles.has(file)) {
    // The stored copy failed validation on load; writing would replace the
    // user's real data with in-memory defaults. Keep it read-only.
    set({ syncStatus: "error" });
    return;
  }
  const payload = data[file];
  const previous = pendingWrites.get(file) ?? Promise.resolve();
  const next = previous
    .then(() => repo.save(file, payload))
    .then(() => {
      if (pendingWrites.get(file) === next) pendingWrites.delete(file);
      failedFiles.delete(file);
      if (pendingWrites.size === 0 && failedFiles.size === 0) {
        set({ syncStatus: "synced" });
      }
    })
    .catch(() => {
      if (pendingWrites.get(file) === next) pendingWrites.delete(file);
      failedFiles.add(file);
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
    const { data: loaded, invalidFiles } = await repository.loadAll();
    protectedFiles.clear();
    for (const file of invalidFiles) protectedFiles.add(file);
    if (invalidFiles.length > 0) {
      toast.error(
        `Some data could not be read and is protected from overwrites: ${invalidFiles.join(", ")}. Restore a backup or fix the stored file, then reload.`,
        { duration: 10000 },
      );
    }
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
    maybeCaptureSnapshot();
    void get().refreshPrices();
  };

  const maybeCaptureSnapshot = (): void => {
    const { accounts, expenses, snapshots } = get().data;
    const result = upsertSnapshot(snapshots, buildSnapshot(accounts, expenses));
    if (!result.changed) return;
    mutate("snapshots", () => result.history);
  };

  const setGroup = (groupId: string, next: Group): void => {
    mutate("groups", ({ groups }) =>
      groups.map((group) => (group.id === groupId ? next : group)),
    );
  };

  const pushGroup = async (groupId: string): Promise<void> => {
    const group = get().data.groups.find((item) => item.id === groupId);
    if (!group?.remoteId) return;
    const result = await pushRemoteGroup(group.remoteId, group.rev, group);
    if (result.status === "ok") {
      const latest = get().data.groups.find((item) => item.id === groupId);
      if (latest) setGroup(groupId, { ...latest, rev: result.group.rev });
      return;
    }
    if (result.status === "conflict") {
      const latest = get().data.groups.find((item) => item.id === groupId);
      if (!latest) return;
      const merged = mergeSharedIntoLocal(latest, result.group);
      setGroup(groupId, merged);
      const retry = await pushRemoteGroup(
        merged.remoteId ?? group.remoteId,
        result.group.rev,
        merged,
      );
      if (retry.status === "ok") {
        const after = get().data.groups.find((item) => item.id === groupId);
        if (after) setGroup(groupId, { ...after, rev: retry.group.rev });
      }
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
      } catch (error) {
        if (isAuthError(error)) {
          // The token is actually rejected — only then drop the session.
          clearSession();
          repository = null;
          attachmentStore = null;
          set({ status: "unauthenticated", session: null });
        } else {
          // Network trouble (offline, GitHub down) must not sign the user out.
          set({ status: "offline" });
        }
      }
    },

    retryInitialize: async () => {
      const session = get().session;
      if (!session) {
        set({ status: "unauthenticated" });
        return;
      }
      try {
        await loadData(session);
      } catch (error) {
        if (isAuthError(error)) {
          clearSession();
          repository = null;
          attachmentStore = null;
          set({ status: "unauthenticated", session: null });
        } else {
          set({ status: "offline" });
        }
      }
    },

    retrySync: () => {
      const files = [...failedFiles];
      if (files.length === 0) return;
      failedFiles.clear();
      const data = get().data;
      for (const file of files) persist(file, data, set);
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
      failedFiles.clear();
      protectedFiles.clear();
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

      // Learn from the correction: recategorizing a recognizable merchant
      // offers a one-tap rule so future captures classify themselves.
      const newCategory = patch.category;
      if (
        current &&
        (current.type ?? "expense") === "expense" &&
        newCategory &&
        newCategory !== current.category
      ) {
        const brand = resolveBrand(current.description);
        const matchText = (brand?.name ?? current.description).trim();
        if (matchText.length >= 3) {
          const exists = get().data.rules.some(
            (rule) =>
              rule.match.text?.toLowerCase() === matchText.toLowerCase(),
          );
          if (!exists) {
            toast(`Always file “${matchText}” under ${newCategory}?`, {
              duration: 8000,
              action: {
                label: "Create rule",
                onClick: () =>
                  get().addRule({
                    name: `${matchText} → ${newCategory}`,
                    enabled: true,
                    match: { text: matchText },
                    actions: { category: newCategory, tags: [] },
                  }),
              },
            });
          }
        }
      }
    },

    deleteExpense: (id) => {
      const target = get().data.expenses.find((item) => item.id === id);
      if (target && attachmentStore) {
        const store = attachmentStore;
        for (const attachment of target.attachments) {
          void store.remove(attachment.id, attachment.mimeType);
        }
      }
      mutateLedger(({ expenses, accounts }) => {
        const newExpenses = expenses.filter((item) => item.id !== id);
        let newAccounts = accounts;
        
        if (target && target.type === "investment" && target.transferAccountId) {
          const invAccountId = target.transferAccountId;
          const hasOtherTransactions = newExpenses.some(
            (e) => e.accountId === invAccountId || e.transferAccountId === invAccountId
          );
          if (!hasOtherTransactions) {
            newAccounts = accounts.filter((a) => a.id !== invAccountId);
          }
        }
        
        return {
          expenses: newExpenses,
          ...(newAccounts !== accounts ? { accounts: newAccounts } : {})
        };
      });
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
      mutate("groups", ({ groups }) => {
        const members = memberNames.map(
          (memberName): Member => ({ id: createId(), name: memberName }),
        );
        return [
          ...groups,
          {
            id: createId(),
            name,
            members,
            expenses: [],
            settlements: [],
            selfMemberId: members[0]?.id,
            createdAt: new Date().toISOString(),
          },
        ];
      }),

    deleteGroup: (id) =>
      mutate("groups", ({ groups }) =>
        groups.filter((group) => group.id !== id),
      ),

    addMember: (groupId, name) => {
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
      );
      void pushGroup(groupId);
    },

    addGroupExpense: (groupId, expense) => {
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
      );
      void pushGroup(groupId);
    },

    deleteGroupExpense: (groupId, expenseId) => {
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
      );
      void pushGroup(groupId);
    },

    recordGroupSettlement: (groupId, settlement) => {
      mutate("groups", ({ groups }) =>
        groups.map(
          (group): Group =>
            group.id === groupId
              ? {
                  ...group,
                  settlements: [
                    {
                      ...settlement,
                      id: createId(),
                      createdAt: new Date().toISOString(),
                    },
                    ...group.settlements,
                  ],
                }
              : group,
        ),
      );
      void pushGroup(groupId);
    },

    deleteGroupSettlement: (groupId, settlementId) => {
      mutate("groups", ({ groups }) =>
        groups.map(
          (group): Group =>
            group.id === groupId
              ? {
                  ...group,
                  settlements: group.settlements.filter(
                    (item) => item.id !== settlementId,
                  ),
                }
              : group,
        ),
      );
      void pushGroup(groupId);
    },

    shareGroup: async (groupId) => {
      const group = get().data.groups.find((item) => item.id === groupId);
      if (!group) return false;
      if (group.remoteId) return true;
      const shared = await createRemoteGroup(group);
      if (!shared) return false;
      const latest = get().data.groups.find((item) => item.id === groupId);
      if (!latest) return false;
      setGroup(groupId, {
        ...latest,
        remoteId: shared.id,
        rev: shared.rev,
      });
      return true;
    },

    syncGroup: async (groupId) => {
      const group = get().data.groups.find((item) => item.id === groupId);
      if (!group?.remoteId) return;
      const shared = await fetchRemoteGroup(group.remoteId);
      if (!shared) return;
      const latest = get().data.groups.find((item) => item.id === groupId);
      if (!latest) return;
      const merged = mergeSharedIntoLocal(latest, shared);
      const localExtra =
        merged.expenses.length !== shared.expenses.length ||
        merged.settlements.length !== shared.settlements.length ||
        merged.members.length !== shared.members.length;
      setGroup(groupId, merged);
      if (localExtra) void pushGroup(groupId);
    },

    joinGroup: async (remoteId, displayName) => {
      const existing = get().data.groups.find(
        (item) => item.remoteId === remoteId,
      );
      const member: Member = { id: createId(), name: displayName.trim() };
      const shared = await joinRemoteGroup(remoteId, member);
      if (!shared) return null;
      if (existing) {
        const merged = mergeSharedIntoLocal(existing, shared);
        setGroup(existing.id, {
          ...merged,
          selfMemberId: existing.selfMemberId ?? member.id,
        });
        return existing.id;
      }
      const localId = createId();
      const local = sharedToLocal(
        shared,
        localId,
        member.id,
        new Date().toISOString(),
      );
      mutate("groups", ({ groups }) => [...groups, local]);
      return localId;
    },

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

    adjustBalance: (accountId, newBalance, date, hardReset = false) => {
      const account = get().data.accounts.find((a) => a.id === accountId);
      if (!account) return;
      const difference = roundMoney(newBalance - account.balance);
      if (difference === 0) return;
      const usesAdjustmentRow =
        !hardReset &&
        account.type !== "credit_card" &&
        account.type !== "investment";
      const record = {
        id: createId(),
        date,
        actualBalance: newBalance,
        appBalance: account.balance,
        difference,
        adjusted: true,
        createdAt: new Date().toISOString(),
      };
      mutateLedger(({ expenses, accounts }) => {
        const nextAccounts = accounts.map((a) =>
          a.id === accountId
            ? {
                ...a,
                reconciledBalance: newBalance,
                reconciledDate: date,
                reconciliations: [record, ...a.reconciliations],
                ...(usesAdjustmentRow
                  ? {}
                  : { openingBalance: roundMoney(a.openingBalance + difference) }),
              }
            : a,
        );
        if (!usesAdjustmentRow) return { accounts: nextAccounts };
        const isIncome = difference > 0;
        const adjustment: Expense = {
          id: createId(),
          type: isIncome ? "income" : "expense",
          description: "Balance adjustment",
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

    refreshPrices: async () => {
      const endpoint = pricesEndpoint();
      if (!endpoint) return;
      const params = buildPriceParams(get().data.accounts);
      if (!params) return;
      try {
        const response = await fetch(`${endpoint}?${params.toString()}`);
        if (!response.ok) return;
        const body = (await response.json()) as {
          prices?: Record<string, number>;
        };
        const updates = priceUpdates(get().data.accounts, body.prices ?? {});
        if (updates.length === 0) return;
        const at = new Date().toISOString();
        const byId = new Map(updates.map((update) => [update.id, update]));
        mutateLedger(({ accounts }) => ({
          accounts: accounts.map((account) => {
            const update = byId.get(account.id);
            return update
              ? { ...account, currentPrice: update.currentPrice, priceUpdatedAt: at }
              : account;
          }),
        }));
        maybeCaptureSnapshot();
      } catch {
        /* prices are best-effort */
      }
    },

    importStatement: (accountId, fileName, rows) => {
      const state = get().data;
      const result = runImportPipeline({
        rows,
        accountId,
        fileName,
        batchId: createId(),
        now: new Date().toISOString(),
        accounts: state.accounts,
        expenses: state.expenses,
        drafts: state.inbox.drafts,
        rules: state.rules,
        createId,
      });
      if (result.autoMerges.length > 0) {
        const byExpense = new Map(
          result.autoMerges.map((merge) => [merge.expenseId, merge.source]),
        );
        mutateLedger(({ expenses }) => ({
          expenses: expenses.map((expense) => {
            const source = byExpense.get(expense.id);
            return source
              ? {
                  ...expense,
                  accountId: expense.accountId ?? accountId,
                  provenance: [...(expense.provenance ?? []), source],
                }
              : expense;
          }),
        }));
      }
      mutate("inbox", ({ inbox }) => ({
        ...inbox,
        drafts: [...result.drafts, ...inbox.drafts],
        batches: [result.batch, ...inbox.batches].slice(0, 20),
      }));
      return result.batch;
    },

    updateDraft: (id, patch) =>
      mutate("inbox", ({ inbox }) => ({
        ...inbox,
        drafts: inbox.drafts.map((draft) =>
          draft.id === id ? { ...draft, ...patch } : draft,
        ),
      })),

    confirmDraft: (id) => {
      const draft = get().data.inbox.drafts.find((item) => item.id === id);
      if (!draft) return;
      const expense = draftToExpense(draft, createId(), new Date().toISOString());
      mutateLedger(({ expenses }) => ({ expenses: [expense, ...expenses] }));
      mutate("inbox", ({ inbox }) => ({
        ...inbox,
        drafts: inbox.drafts.filter((item) => item.id !== id),
      }));
    },

    confirmPendingDrafts: () => {
      const pending = get().data.inbox.drafts.filter(
        (draft) => draft.status === "pending",
      );
      if (pending.length === 0) return 0;
      const now = new Date().toISOString();
      const created = pending.map((draft) =>
        draftToExpense(draft, createId(), now),
      );
      mutateLedger(({ expenses }) => ({ expenses: [...created, ...expenses] }));
      const confirmedIds = new Set(pending.map((draft) => draft.id));
      mutate("inbox", ({ inbox }) => ({
        ...inbox,
        drafts: inbox.drafts.filter((draft) => !confirmedIds.has(draft.id)),
      }));
      return pending.length;
    },

    rejectDraft: (id) =>
      mutate("inbox", ({ inbox }) => ({
        ...inbox,
        drafts: inbox.drafts.filter((draft) => draft.id !== id),
      })),

    resolveDraftDuplicate: (id, action) => {
      const draft = get().data.inbox.drafts.find((item) => item.id === id);
      if (!draft) return;
      if (action === "merge" && draft.matchExpenseId) {
        const accountId = draft.accountId;
        mutateLedger(({ expenses }) => ({
          expenses: expenses.map((expense) =>
            expense.id === draft.matchExpenseId
              ? {
                  ...expense,
                  accountId: expense.accountId ?? accountId,
                  provenance: [
                    ...(expense.provenance ?? []),
                    {
                      kind: "statement" as const,
                      batchId: draft.batchId,
                      lineHash: draft.lineHash,
                      refNo: draft.refNo,
                    },
                  ],
                }
              : expense,
          ),
        }));
        mutate("inbox", ({ inbox }) => ({
          ...inbox,
          drafts: inbox.drafts.filter((item) => item.id !== id),
        }));
        return;
      }
      mutate("inbox", ({ inbox }) => ({
        ...inbox,
        drafts: inbox.drafts.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "pending" as const,
                matchExpenseId: undefined,
                matchScore: undefined,
              }
            : item,
        ),
      }));
    },

    addRule: (rule) =>
      mutate("rules", ({ rules }) => [
        ...rules,
        { ...rule, id: createId(), createdAt: new Date().toISOString() },
      ]),

    updateRule: (id, patch) =>
      mutate("rules", ({ rules }) =>
        rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
      ),

    deleteRule: (id) =>
      mutate("rules", ({ rules }) => rules.filter((rule) => rule.id !== id)),

    trackSuggestion: (suggestion) => {
      if (suggestionTarget(suggestion) === "subscription") {
        get().addSubscription(suggestionToSubscription(suggestion));
      } else {
        get().addRecurring(suggestionToRecurring(suggestion));
      }
      // The new subscription/template excludes this merchant by name on the
      // next mining pass; dismissing the key covers renames too.
      get().dismissSuggestion(suggestion.key);
    },

    dismissSuggestion: (key) =>
      mutate("inbox", ({ inbox }) =>
        inbox.dismissedSuggestions.includes(key)
          ? inbox
          : {
              ...inbox,
              dismissedSuggestions: [...inbox.dismissedSuggestions, key],
            },
      ),

    exportBackup: () => buildBackup(get().data),

    importBackup: async (json) => {
      const parsed = parseBackup(json);
      const accounts = recomputeBalances(parsed.accounts, parsed.expenses);
      const data: LedgerData = { ...parsed, accounts };
      // A validated backup replaces everything — including files that were
      // read-only because their stored copy failed validation.
      protectedFiles.clear();
      set({ data });
      for (const file of DATA_FILES) persist(file, data, set);
    },
  };
});
