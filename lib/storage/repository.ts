import { z } from "zod";
import type { DataFile, StorageAdapter } from "./adapter";
import { migrate } from "./migrations";
import {
  accountsFileSchema,
  budgetsSchema,
  DEFAULT_ACCOUNTS,
  DEFAULT_BUDGETS,
  DEFAULT_SETTINGS,
  expensesFileSchema,
  groupsFileSchema,
  recurringFileSchema,
  settingsSchema,
  spacesFileSchema,
  subscriptionsFileSchema,
  type Account,
  type Budgets,
  type Expense,
  type Group,
  type RecurringExpense,
  type Settings,
  type Space,
  type Subscription,
  type LendBorrow,
  lendBorrowsFileSchema,
  type RecurringInvestment,
  type Goal,
  recurringInvestmentsFileSchema,
  goalsFileSchema,
  type InboxData,
  type Rule,
  inboxSchema,
  rulesFileSchema,
  DEFAULT_INBOX,
} from "../domain/types";

export interface LedgerData {
  expenses: Expense[];
  recurring: RecurringExpense[];
  groups: Group[];
  budgets: Budgets;
  settings: Settings;
  accounts: Account[];
  spaces: Space[];
  subscriptions: Subscription[];
  lendBorrows: LendBorrow[];
  recurringInvestments: RecurringInvestment[];
  goals: Goal[];
  inbox: InboxData;
  rules: Rule[];
}

export const EMPTY_DATA: LedgerData = {
  expenses: [],
  recurring: [],
  groups: [],
  budgets: DEFAULT_BUDGETS,
  settings: DEFAULT_SETTINGS,
  accounts: DEFAULT_ACCOUNTS,
  spaces: [],
  subscriptions: [],
  lendBorrows: [],
  recurringInvestments: [],
  goals: [],
  inbox: DEFAULT_INBOX,
  rules: [],
};

export const FILE_SCHEMAS = {
  expenses: expensesFileSchema,
  recurring: recurringFileSchema,
  groups: groupsFileSchema,
  budgets: budgetsSchema,
  settings: settingsSchema,
  accounts: accountsFileSchema,
  spaces: spacesFileSchema,
  subscriptions: subscriptionsFileSchema,
  lendBorrows: lendBorrowsFileSchema,
  recurringInvestments: recurringInvestmentsFileSchema,
  goals: goalsFileSchema,
  inbox: inboxSchema,
  rules: rulesFileSchema,
} satisfies Record<DataFile, z.ZodType>;

export interface LoadResult {
  data: LedgerData;
  /**
   * Files whose stored content failed to parse or validate. Their in-memory
   * value is the default fallback, and callers MUST NOT persist over them —
   * writing would replace the user's real (recoverable) data with emptiness.
   */
  invalidFiles: DataFile[];
}

export class LedgerRepository {
  constructor(private adapter: StorageAdapter) {}

  private async readCollection<K extends DataFile>(
    file: K,
    fallback: LedgerData[K],
    invalid: DataFile[],
  ): Promise<LedgerData[K]> {
    const raw = await this.adapter.readFile(file);
    if (raw === null) return fallback;
    try {
      const migrated = migrate(file, JSON.parse(raw));
      const parsed = FILE_SCHEMAS[file].safeParse(migrated);
      if (!parsed.success) {
        invalid.push(file);
        return fallback;
      }
      return parsed.data as LedgerData[K];
    } catch {
      invalid.push(file);
      return fallback;
    }
  }

  async loadAll(): Promise<LoadResult> {
    const invalid: DataFile[] = [];
    const [
      expenses,
      recurring,
      groups,
      budgets,
      settings,
      accounts,
      spaces,
      subscriptions,
      lendBorrows,
      recurringInvestments,
      goals,
      inbox,
      rules,
    ] = await Promise.all([
      this.readCollection("expenses", EMPTY_DATA.expenses, invalid),
      this.readCollection("recurring", EMPTY_DATA.recurring, invalid),
      this.readCollection("groups", EMPTY_DATA.groups, invalid),
      this.readCollection("budgets", EMPTY_DATA.budgets, invalid),
      this.readCollection("settings", EMPTY_DATA.settings, invalid),
      this.readCollection("accounts", EMPTY_DATA.accounts, invalid),
      this.readCollection("spaces", EMPTY_DATA.spaces, invalid),
      this.readCollection("subscriptions", EMPTY_DATA.subscriptions, invalid),
      this.readCollection("lendBorrows", EMPTY_DATA.lendBorrows, invalid),
      this.readCollection(
        "recurringInvestments",
        EMPTY_DATA.recurringInvestments,
        invalid,
      ),
      this.readCollection("goals", EMPTY_DATA.goals, invalid),
      this.readCollection("inbox", EMPTY_DATA.inbox, invalid),
      this.readCollection("rules", EMPTY_DATA.rules, invalid),
    ]);
    return {
      data: {
        expenses,
        recurring,
        groups,
        budgets,
        settings,
        accounts,
        spaces,
        subscriptions,
        lendBorrows,
        recurringInvestments,
        goals,
        inbox,
        rules,
      },
      invalidFiles: invalid,
    };
  }

  async save<K extends DataFile>(file: K, data: LedgerData[K]): Promise<void> {
    await this.adapter.writeFile(file, JSON.stringify(data, null, 2));
  }
}
