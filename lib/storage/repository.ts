import { z } from "zod";
import type { DataFile, StorageAdapter } from "./adapter";
import {
  budgetsSchema,
  DEFAULT_BUDGETS,
  DEFAULT_SETTINGS,
  expensesFileSchema,
  groupsFileSchema,
  recurringFileSchema,
  settingsSchema,
  type Budgets,
  type Expense,
  type Group,
  type RecurringExpense,
  type Settings,
} from "../domain/types";

export interface LedgerData {
  expenses: Expense[];
  recurring: RecurringExpense[];
  groups: Group[];
  budgets: Budgets;
  settings: Settings;
}

export const EMPTY_DATA: LedgerData = {
  expenses: [],
  recurring: [],
  groups: [],
  budgets: DEFAULT_BUDGETS,
  settings: DEFAULT_SETTINGS,
};

const FILE_SCHEMAS = {
  expenses: expensesFileSchema,
  recurring: recurringFileSchema,
  groups: groupsFileSchema,
  budgets: budgetsSchema,
  settings: settingsSchema,
} satisfies Record<DataFile, z.ZodType>;

export class LedgerRepository {
  constructor(private adapter: StorageAdapter) {}

  private async readCollection<K extends DataFile>(
    file: K,
    fallback: LedgerData[K],
  ): Promise<LedgerData[K]> {
    const raw = await this.adapter.readFile(file);
    if (raw === null) return fallback;
    const parsed = FILE_SCHEMAS[file].safeParse(JSON.parse(raw));
    if (!parsed.success) return fallback;
    return parsed.data as LedgerData[K];
  }

  async loadAll(): Promise<LedgerData> {
    const [expenses, recurring, groups, budgets, settings] = await Promise.all([
      this.readCollection("expenses", EMPTY_DATA.expenses),
      this.readCollection("recurring", EMPTY_DATA.recurring),
      this.readCollection("groups", EMPTY_DATA.groups),
      this.readCollection("budgets", EMPTY_DATA.budgets),
      this.readCollection("settings", EMPTY_DATA.settings),
    ]);
    return { expenses, recurring, groups, budgets, settings };
  }

  async save<K extends DataFile>(file: K, data: LedgerData[K]): Promise<void> {
    await this.adapter.writeFile(file, JSON.stringify(data, null, 2));
  }
}
