import { z } from "zod";

export const CATEGORIES = [
  "Food",
  "Travel",
  "Shopping",
  "Bills",
  "Health",
  "Education",
  "Entertainment",
  "Investments",
  "Other",
] as const;

export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

export const ACCOUNT_TYPES = [
  "cash",
  "bank",
  "credit_card",
  "debit_card",
  "wallet",
  "investment",
  "other",
] as const;

export const accountTypeSchema = z.enum(ACCOUNT_TYPES);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const RECURRENCE_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;

export const recurrenceFrequencySchema = z.enum(RECURRENCE_FREQUENCIES);
export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>;

export const BILLING_CYCLES = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;

export const billingCycleSchema = z.enum(BILLING_CYCLES);
export type BillingCycle = z.infer<typeof billingCycleSchema>;

export const SPLIT_TYPES = ["equal", "unequal", "percentage"] as const;
export const splitTypeSchema = z.enum(SPLIT_TYPES);
export type SplitType = z.infer<typeof splitTypeSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const attachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().nonnegative(),
  createdAt: z.string().min(1),
});
export type Attachment = z.infer<typeof attachmentSchema>;

export const bankAccountTypeSchema = z.enum([
  "Savings",
  "Current",
  "Salary",
  "Joint",
  "NRE",
  "NRO",
  "Business",
]);
export type BankAccountType = z.infer<typeof bankAccountTypeSchema>;

export const debitCardSchema = z.object({
  id: z.string().min(1),
  network: z.enum(["Visa", "Mastercard", "RuPay"]),
  expiryDate: z.string(),
  last4Digits: z.string().length(4),
});
export type DebitCard = z.infer<typeof debitCardSchema>;

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: accountTypeSchema,
  balance: z.number(),
  currency: z.string().min(1),
  icon: z.string().min(1),
  archived: z.boolean().default(false),
  creditLimit: z.number().optional(),
  statementBalance: z.number().optional(),
  minimumBalance: z.number().optional(),
  holderName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  branchName: z.string().optional(),
  bankAccountType: bankAccountTypeSchema.optional(),
  debitCards: z.array(debitCardSchema).default([]),
  createdAt: z.string().min(1),
});
export type Account = z.infer<typeof accountSchema>;

export const spaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  budget: z.number().nonnegative().default(0),
  icon: z.string().min(1),
  archived: z.boolean().default(false),
  createdAt: z.string().min(1),
});
export type Space = z.infer<typeof spaceSchema>;

export const subscriptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().positive(),
  billingCycle: billingCycleSchema,
  category: categorySchema,
  nextRenewalDate: isoDate,
  accountId: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().default(true),
  createdAt: z.string().min(1),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const expenseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  category: categorySchema,
  date: isoDate,
  createdAt: z.string().min(1),
  recurringId: z.string().optional(),
  subscriptionId: z.string().optional(),
  accountId: z.string().optional(),
  type: z.enum(["expense", "income", "transfer"]).default("expense"),
  transferAccountId: z.string().optional(),
  debitCardId: z.string().optional(),
  spaceId: z.string().optional(),
  tags: z.array(z.string().min(1)).default([]),
  notes: z.string().optional(),
  attachments: z.array(attachmentSchema).default([]),
});
export type Expense = z.infer<typeof expenseSchema>;

export const recurringExpenseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  category: categorySchema,
  frequency: recurrenceFrequencySchema.default("monthly"),
  dayOfMonth: z.number().int().min(1).max(31),
  weekday: z.number().int().min(0).max(6).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  startDate: isoDate,
  lastMaterializedDate: isoDate.optional(),
  accountId: z.string().optional(),
  spaceId: z.string().optional(),
  active: z.boolean(),
  createdAt: z.string().min(1),
});
export type RecurringExpense = z.infer<typeof recurringExpenseSchema>;

export const memberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type Member = z.infer<typeof memberSchema>;

export const splitShareSchema = z.object({
  memberId: z.string().min(1),
  value: z.number().nonnegative(),
});
export type SplitShare = z.infer<typeof splitShareSchema>;

export const groupExpenseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  paidBy: z.string().min(1),
  splitType: splitTypeSchema.default("equal"),
  splitAmong: z.array(z.string().min(1)).min(1),
  shares: z.array(splitShareSchema).default([]),
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
  categoryBudgets: z.record(z.string(), z.number().nonnegative()).default({}),
});
export type Budgets = z.infer<typeof budgetsSchema>;

export const settingsSchema = z.object({
  currency: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
});
export type Settings = z.infer<typeof settingsSchema>;

export const expensesFileSchema = z.array(expenseSchema);
export const recurringFileSchema = z.array(recurringExpenseSchema);
export const groupsFileSchema = z.array(groupSchema);
export const accountsFileSchema = z.array(accountSchema);
export const spacesFileSchema = z.array(spaceSchema);
export const subscriptionsFileSchema = z.array(subscriptionSchema);

export const lendBorrowTypeSchema = z.enum(["lent", "borrowed"]);
export type LendBorrowType = z.infer<typeof lendBorrowTypeSchema>;

export const lendBorrowRepaymentSchema = z.object({
  id: z.string().min(1),
  amount: z.number().positive(),
  date: isoDate,
  accountId: z.string().optional(),
  createdAt: z.string().min(1),
});
export type LendBorrowRepayment = z.infer<typeof lendBorrowRepaymentSchema>;

export const lendBorrowSchema = z.object({
  id: z.string().min(1),
  type: lendBorrowTypeSchema,
  personName: z.string().min(1),
  amount: z.number().positive(),
  date: isoDate,
  description: z.string().min(1),
  accountId: z.string().optional(),
  dueDate: isoDate.optional(),
  phoneNumber: z.string().optional(),
  notes: z.string().optional(),
  repayments: z.array(lendBorrowRepaymentSchema).default([]),
  attachments: z.array(attachmentSchema).default([]),
  createdAt: z.string().min(1),
});
export type LendBorrow = z.infer<typeof lendBorrowSchema>;

export const lendBorrowsFileSchema = z.array(lendBorrowSchema);

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: "acc-cash",
    name: "Cash",
    type: "cash",
    balance: 0,
    currency: "₹",
    icon: "💵",
    archived: false,
    debitCards: [],
    createdAt: "1970-01-01T00:00:00.000Z",
  },
  {
    id: "acc-bank",
    name: "Bank Account",
    type: "bank",
    balance: 0,
    currency: "₹",
    icon: "🏦",
    archived: false,
    debitCards: [],
    createdAt: "1970-01-01T00:00:00.000Z",
  },
];

export const DEFAULT_BUDGETS: Budgets = {
  monthlyBudget: 0,
  categoryBudgets: {},
};

export const DEFAULT_SETTINGS: Settings = {
  currency: "₹",
  tags: [],
};

export const SPACE_ICONS = [
  "🌄", "✈️", "🏠", "💻", "🎓", "💍", "🏖️", "🚗", "🎉", "🛒",
  "🏔️", "🍽️", "📦", "🎁", "🏥", "📚", "🐾", "⚽",
];

export const ACCOUNT_ICONS = [
  "💵", "🏦", "💳", "👛", "📈", "💰", "🪙", "🏧",
];

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}
