import { z } from "zod";

export const CATEGORIES = [
  "Food",
  "Travel",
  "Shopping",
  "Bills",
  "Health",
  "Education",
  "Other",
] as const;

export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const isoMonth = z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM");

export const expenseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  category: categorySchema,
  date: isoDate,
  createdAt: z.string().min(1),
  recurringId: z.string().optional(),
});
export type Expense = z.infer<typeof expenseSchema>;

export const recurringExpenseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  category: categorySchema,
  dayOfMonth: z.number().int().min(1).max(31),
  startMonth: isoMonth,
  lastMaterializedMonth: isoMonth.optional(),
  active: z.boolean(),
  createdAt: z.string().min(1),
});
export type RecurringExpense = z.infer<typeof recurringExpenseSchema>;

export const memberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type Member = z.infer<typeof memberSchema>;

export const groupExpenseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  paidBy: z.string().min(1),
  splitAmong: z.array(z.string().min(1)).min(1),
  date: isoDate,
  createdAt: z.string().min(1),
});
export type GroupExpense = z.infer<typeof groupExpenseSchema>;

export const groupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  members: z.array(memberSchema),
  expenses: z.array(groupExpenseSchema),
  createdAt: z.string().min(1),
});
export type Group = z.infer<typeof groupSchema>;

export const budgetsSchema = z.object({
  monthlyBudget: z.number().nonnegative(),
});
export type Budgets = z.infer<typeof budgetsSchema>;

export const settingsSchema = z.object({
  currency: z.string().min(1),
});
export type Settings = z.infer<typeof settingsSchema>;

export const expensesFileSchema = z.array(expenseSchema);
export const recurringFileSchema = z.array(recurringExpenseSchema);
export const groupsFileSchema = z.array(groupSchema);

export const DEFAULT_BUDGETS: Budgets = { monthlyBudget: 0 };
export const DEFAULT_SETTINGS: Settings = { currency: "₹" };

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}
