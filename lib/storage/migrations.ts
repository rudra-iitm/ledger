import type { DataFile } from "./adapter";
import { clampedDateInMonth, todayISO } from "../domain/dates";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function migrateExpense(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const next: UnknownRecord = { tags: [], attachments: [], ...raw };
  if ("paymentMethodId" in next && !("accountId" in next)) {
    delete next.paymentMethodId;
  }
  if (!("affectsBalance" in next)) next.affectsBalance = true;
  return next;
}

function migrateAccount(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const next: UnknownRecord = { ...raw };
  if (!("openingBalance" in next)) {
    next.openingBalance = typeof next.balance === "number" ? next.balance : 0;
    if (!("openingDate" in next)) next.openingDate = todayISO();
  }
  return next;
}

function migrateRecurring(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const next: UnknownRecord = { frequency: "monthly", ...raw };
  if (!("startDate" in next) && typeof next.startMonth === "string") {
    const day = typeof next.dayOfMonth === "number" ? next.dayOfMonth : 1;
    next.startDate = clampedDateInMonth(next.startMonth, day);
  }
  if (
    !("lastMaterializedDate" in next) &&
    typeof next.lastMaterializedMonth === "string"
  ) {
    const day = typeof next.dayOfMonth === "number" ? next.dayOfMonth : 1;
    next.lastMaterializedDate = clampedDateInMonth(
      next.lastMaterializedMonth,
      day,
    );
  }
  return next;
}

function migrateGroup(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const expenses = Array.isArray(raw.expenses)
    ? raw.expenses.map((expense) =>
        isRecord(expense)
          ? { splitType: "equal", shares: [], ...expense }
          : expense,
      )
    : raw.expenses;
  const settlements = Array.isArray(raw.settlements) ? raw.settlements : [];
  return { settlements, ...raw, expenses };
}

function migrateBudgets(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  return { categoryBudgets: {}, ...raw };
}

function migrateSettings(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const next: UnknownRecord = { tags: [], ...raw };
  delete next.paymentMethods;
  return next;
}

export function migrate(file: DataFile, raw: unknown): unknown {
  switch (file) {
    case "expenses":
      return Array.isArray(raw) ? raw.map(migrateExpense) : raw;
    case "recurring":
      return Array.isArray(raw) ? raw.map(migrateRecurring) : raw;
    case "groups":
      return Array.isArray(raw) ? raw.map(migrateGroup) : raw;
    case "accounts":
      return Array.isArray(raw) ? raw.map(migrateAccount) : raw;
    case "budgets":
      return migrateBudgets(raw);
    case "settings":
      return migrateSettings(raw);
    default:
      return raw;
  }
}
