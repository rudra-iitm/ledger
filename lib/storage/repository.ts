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
};

const FILE_SCHEMAS = {
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
} satisfies Record<DataFile, z.ZodType>;

export class LedgerRepository {
  constructor(private adapter: StorageAdapter) {}

  private async readCollection<K extends DataFile>(
    file: K,
    fallback: LedgerData[K],
  ): Promise<LedgerData[K]> {
    const raw = await this.adapter.readFile(file);
    if (raw === null) return fallback;
    const migrated = migrate(file, JSON.parse(raw));
    const parsed = FILE_SCHEMAS[file].safeParse(migrated);
    if (!parsed.success) return fallback;
    return parsed.data as LedgerData[K];
  }

  async loadAll(): Promise<LedgerData> {
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
    ] = await Promise.all([
      this.readCollection("expenses", EMPTY_DATA.expenses),
      this.readCollection("recurring", EMPTY_DATA.recurring),
      this.readCollection("groups", EMPTY_DATA.groups),
      this.readCollection("budgets", EMPTY_DATA.budgets),
      this.readCollection("settings", EMPTY_DATA.settings),
      this.readCollection("accounts", EMPTY_DATA.accounts),
      this.readCollection("spaces", EMPTY_DATA.spaces),
      this.readCollection("subscriptions", EMPTY_DATA.subscriptions),
      this.readCollection("lendBorrows", EMPTY_DATA.lendBorrows),
      this.readCollection("recurringInvestments", EMPTY_DATA.recurringInvestments),
      this.readCollection("goals", EMPTY_DATA.goals),
    ]);
    return {
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
    };
  }

  async save<K extends DataFile>(file: K, data: LedgerData[K]): Promise<void> {
    await this.adapter.writeFile(file, JSON.stringify(data, null, 2));
  }
}
