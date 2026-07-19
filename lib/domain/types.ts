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

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Interest",
  "Dividends",
  "Refunds",
  "Gifts",
  "Investments",
  "Other",
] as const;

export const incomeCategorySchema = z.enum(INCOME_CATEGORIES);
export type IncomeCategory = z.infer<typeof incomeCategorySchema>;

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

export const ASSET_TYPES = [
  "gold",
  "silver",
  "mutual_fund",
  "etf",
  "stock",
  "sip",
  "crypto",
  "other",
] as const;

export const assetTypeSchema = z.enum(ASSET_TYPES);
export type AssetType = z.infer<typeof assetTypeSchema>;

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  gold: "Gold",
  silver: "Silver",
  mutual_fund: "Mutual Fund",
  etf: "ETF",
  stock: "Stock",
  sip: "SIP",
  crypto: "Crypto",
  other: "Other",
};

export const ASSET_UNIT_LABELS: Record<AssetType, string> = {
  gold: "g",
  silver: "g",
  mutual_fund: "units",
  etf: "units",
  stock: "shares",
  sip: "units",
  crypto: "coins",
  other: "units",
};

export const INVESTMENT_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;

export const investmentFrequencySchema = z.enum(INVESTMENT_FREQUENCIES);
export type InvestmentFrequency = z.infer<typeof investmentFrequencySchema>;

export const GOAL_TYPES = [
  "gold",
  "silver",
  "emergency",
  "house",
  "retirement",
  "education",
  "travel",
  "custom",
] as const;

export const goalTypeSchema = z.enum(GOAL_TYPES);
export type GoalType = z.infer<typeof goalTypeSchema>;

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

export const expenseSourceSchema = z.object({
  kind: z.enum(["manual", "statement", "capture"]),
  batchId: z.string().optional(),
  lineHash: z.string().optional(),
  refNo: z.string().optional(),
});
export type ExpenseSource = z.infer<typeof expenseSourceSchema>;

export const csvMappingSchema = z.object({
  dateCol: z.number().int().nonnegative(),
  descCol: z.number().int().nonnegative(),
  debitCol: z.number().int().nonnegative().optional(),
  creditCol: z.number().int().nonnegative().optional(),
  amountCol: z.number().int().nonnegative().optional(),
  refCol: z.number().int().nonnegative().optional(),
  balanceCol: z.number().int().nonnegative().optional(),
  hasHeader: z.boolean().default(true),
});
export type CsvMapping = z.infer<typeof csvMappingSchema>;

export const reconciliationSchema = z.object({
  id: z.string().min(1),
  date: isoDate,
  actualBalance: z.number(),
  appBalance: z.number(),
  difference: z.number(),
  adjusted: z.boolean().default(false),
  createdAt: z.string().min(1),
});
export type Reconciliation = z.infer<typeof reconciliationSchema>;

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: accountTypeSchema,
  balance: z.number(),
  openingBalance: z.number().default(0),
  openingDate: isoDate.optional(),
  currency: z.string().min(1).optional(),
  icon: z.string().min(1),
  archived: z.boolean().default(false),
  creditLimit: z.number().optional(),
  statementBalance: z.number().optional(),
  statementDueDate: isoDate.optional(),
  minimumDue: z.number().optional(),
  minimumBalance: z.number().optional(),
  assetType: assetTypeSchema.optional(),
  unitLabel: z.string().optional(),
  currentPrice: z.number().nonnegative().optional(),
  priceId: z.string().optional(),
  priceUpdatedAt: z.string().optional(),
  reconciledBalance: z.number().optional(),
  reconciledDate: isoDate.optional(),
  reconciliations: z.array(reconciliationSchema).default([]),
  holderName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  branchName: z.string().optional(),
  bankAccountType: bankAccountTypeSchema.optional(),
  debitCards: z.array(debitCardSchema).default([]),
  csvMapping: csvMappingSchema.optional(),
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
  type: z
    .enum(["expense", "income", "transfer", "cc_payment", "investment"])
    .default("expense"),
  transferAccountId: z.string().optional(),
  paymentTargetId: z.string().optional(),
  units: z.number().nonnegative().optional(),
  incomeCategory: incomeCategorySchema.optional(),
  source: z.string().optional(),
  affectsBalance: z.boolean().default(true),
  debitCardId: z.string().optional(),
  spaceId: z.string().optional(),
  tags: z.array(z.string().min(1)).default([]),
  notes: z.string().optional(),
  attachments: z.array(attachmentSchema).default([]),
  updatedAt: z.string().optional(),
  history: z
    .array(
      z.object({
        at: z.string().min(1),
        field: z.string().min(1),
        from: z.string(),
        to: z.string(),
      }),
    )
    .optional(),
  provenance: z.array(expenseSourceSchema).optional(),
});
export type Expense = z.infer<typeof expenseSchema>;

export const recurringExpenseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  category: categorySchema,
  kind: z
    .enum(["expense", "income", "transfer", "cc_payment"])
    .default("expense"),
  transferAccountId: z.string().optional(),
  incomeCategory: incomeCategorySchema.optional(),
  source: z.string().optional(),
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

export const groupSettlementSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  amount: z.number().positive(),
  date: isoDate,
  note: z.string().optional(),
  createdAt: z.string().min(1),
});
export type GroupSettlement = z.infer<typeof groupSettlementSchema>;

export const groupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  members: z.array(memberSchema),
  expenses: z.array(groupExpenseSchema),
  settlements: z.array(groupSettlementSchema).default([]),
  remoteId: z.string().optional(),
  rev: z.number().int().nonnegative().optional(),
  selfMemberId: z.string().optional(),
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
  showInvestmentsInExpenses: z.boolean().default(false),
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

export const recurringInvestmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  assetType: assetTypeSchema,
  amount: z.number().positive(),
  units: z.number().nonnegative().optional(),
  fromAccountId: z.string().min(1),
  investmentAccountId: z.string().min(1),
  frequency: investmentFrequencySchema,
  dayOfMonth: z.number().int().min(1).max(31).default(1),
  weekday: z.number().int().min(0).max(6).optional(),
  startDate: isoDate,
  lastMaterializedDate: isoDate.optional(),
  notes: z.string().optional(),
  affectsBalance: z.boolean().default(true),
  active: z.boolean().default(true),
  createdAt: z.string().min(1),
});
export type RecurringInvestment = z.infer<typeof recurringInvestmentSchema>;

export const goalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: goalTypeSchema,
  targetAmount: z.number().positive(),
  accountIds: z.array(z.string().min(1)).default([]),
  targetDate: isoDate.optional(),
  icon: z.string().min(1).default("🎯"),
  notes: z.string().optional(),
  createdAt: z.string().min(1),
});
export type Goal = z.infer<typeof goalSchema>;

export const recurringInvestmentsFileSchema = z.array(recurringInvestmentSchema);
export const goalsFileSchema = z.array(goalSchema);

export const snapshotSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  capturedAt: z.string().min(1),
  netWorth: z.number(),
  assetsTotal: z.number(),
  liabilitiesTotal: z.number(),
  invested: z.number().default(0),
  portfolioValue: z.number().default(0),
  accounts: z
    .array(z.object({ accountId: z.string().min(1), balance: z.number() }))
    .default([]),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export const snapshotsFileSchema = z.array(snapshotSchema);

export const draftDirectionSchema = z.enum(["debit", "credit"]);
export type DraftDirection = z.infer<typeof draftDirectionSchema>;

export const draftStatusSchema = z.enum(["pending", "review"]);
export type DraftStatus = z.infer<typeof draftStatusSchema>;

export const draftTransactionSchema = z.object({
  id: z.string().min(1),
  batchId: z.string().min(1),
  accountId: z.string().min(1),
  date: isoDate,
  amount: z.number().positive(),
  direction: draftDirectionSchema,
  description: z.string().min(1),
  rawNarration: z.string(),
  channel: z.string().optional(),
  refNo: z.string().optional(),
  vpa: z.string().optional(),
  suggestedType: z
    .enum(["expense", "income", "transfer", "cc_payment"])
    .default("expense"),
  suggestedCategory: categorySchema.default("Other"),
  suggestedIncomeCategory: incomeCategorySchema.optional(),
  transferAccountId: z.string().optional(),
  tags: z.array(z.string().min(1)).default([]),
  notes: z.string().optional(),
  spaceId: z.string().optional(),
  lineHash: z.string().min(1),
  status: draftStatusSchema.default("pending"),
  matchExpenseId: z.string().optional(),
  matchScore: z.number().optional(),
  appliedRuleId: z.string().optional(),
  createdAt: z.string().min(1),
});
export type DraftTransaction = z.infer<typeof draftTransactionSchema>;

export const importBatchSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  fileName: z.string().min(1),
  importedAt: z.string().min(1),
  rowCount: z.number().int().nonnegative(),
  newCount: z.number().int().nonnegative(),
  autoMergedCount: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  duplicateCount: z.number().int().nonnegative(),
  closingBalance: z.number().optional(),
});
export type ImportBatch = z.infer<typeof importBatchSchema>;

export const inboxSchema = z.object({
  drafts: z.array(draftTransactionSchema).default([]),
  batches: z.array(importBatchSchema).default([]),
});
export type InboxData = z.infer<typeof inboxSchema>;

export const DEFAULT_INBOX: InboxData = { drafts: [], batches: [] };

export const ruleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  match: z.object({
    text: z.string().optional(),
    channel: z.string().optional(),
    accountId: z.string().optional(),
    direction: draftDirectionSchema.optional(),
    minAmount: z.number().optional(),
    maxAmount: z.number().optional(),
  }),
  actions: z.object({
    category: categorySchema.optional(),
    incomeCategory: incomeCategorySchema.optional(),
    tags: z.array(z.string().min(1)).default([]),
    spaceId: z.string().optional(),
    renameTo: z.string().optional(),
  }),
  createdAt: z.string().min(1),
});
export type Rule = z.infer<typeof ruleSchema>;

export const rulesFileSchema = z.array(ruleSchema);

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: "acc-cash",
    name: "Cash",
    type: "cash",
    balance: 0,
    openingBalance: 0,
    currency: "₹",
    icon: "💵",
    archived: false,
    debitCards: [],
    reconciliations: [],
    createdAt: "1970-01-01T00:00:00.000Z",
  },
  {
    id: "acc-bank",
    name: "Bank Account",
    type: "bank",
    balance: 0,
    openingBalance: 0,
    currency: "₹",
    icon: "🏦",
    archived: false,
    debitCards: [],
    reconciliations: [],
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
  showInvestmentsInExpenses: false,
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
