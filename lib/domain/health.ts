import type { Account, Budgets, Expense } from "./types";
import { buildPortfolio } from "./investments";
import { categoryBudgetSummaries } from "./budget";
import { isLiquid } from "./forecast";
import { addDays, monthOf, previousMonth, todayISO } from "./dates";
import { roundMoney } from "./money";
import { isIncome, isSpend } from "./transactions";

/**
 * Financial health score: six deterministic, explainable components.
 * Every score has a formula in its detail string — the value of the score
 * is knowing what to fix next, not the number itself.
 */

export interface HealthComponent {
  key: string;
  label: string;
  /** 0–100 */
  score: number;
  weight: number;
  value: string;
  detail: string;
}

export interface HealthReport {
  /** Weighted 0–100 */
  score: number;
  components: HealthComponent[];
  /** True when there's too little history for the score to mean much. */
  thin: boolean;
}

export interface HealthInput {
  expenses: Expense[];
  accounts: Account[];
  budgets: Budgets;
}

const clampScore = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

function lastFullMonths(today: string, count: number): string[] {
  const months: string[] = [];
  let month = previousMonth(monthOf(today));
  for (let i = 0; i < count; i += 1) {
    months.push(month);
    month = previousMonth(month);
  }
  return months;
}

export function healthReport(
  input: HealthInput,
  now: Date = new Date(),
): HealthReport {
  const today = todayISO(now);
  const months = lastFullMonths(today, 3);
  const monthlySpend = months.map((month) =>
    roundMoney(
      input.expenses
        .filter((row) => isSpend(row) && monthOf(row.date) === month)
        .reduce((sum, row) => sum + row.amount, 0),
    ),
  );
  const monthlyIncome = months.map((month) =>
    roundMoney(
      input.expenses
        .filter((row) => isIncome(row) && monthOf(row.date) === month)
        .reduce((sum, row) => sum + row.amount, 0),
    ),
  );
  const activeSpendMonths = monthlySpend.filter((total) => total > 0);
  const avgSpend =
    activeSpendMonths.length > 0
      ? activeSpendMonths.reduce((sum, total) => sum + total, 0) /
        activeSpendMonths.length
      : 0;
  const totalIncome = monthlyIncome.reduce((sum, total) => sum + total, 0);
  const totalSpend = monthlySpend.reduce((sum, total) => sum + total, 0);

  const components: HealthComponent[] = [];

  // 1. Savings rate — 30%+ of income kept scores full marks.
  if (totalIncome > 0) {
    const rate = (totalIncome - totalSpend) / totalIncome;
    components.push({
      key: "savings",
      label: "Savings rate",
      score: clampScore((rate / 0.3) * 100),
      weight: 25,
      value: `${Math.round(rate * 100)}%`,
      detail: `(income − spending) ÷ income over the last 3 full months. 30%+ scores 100.`,
    });
  } else {
    components.push({
      key: "savings",
      label: "Savings rate",
      score: 50,
      weight: 25,
      value: "—",
      detail:
        "No income tracked in the last 3 months — import a bank statement or add income to score this.",
    });
  }

  // 2. Emergency fund — liquid balance ÷ average monthly spend; 6 months = 100.
  const liquid = roundMoney(
    input.accounts
      .filter((account) => isLiquid(account))
      .reduce((sum, account) => sum + account.balance, 0),
  );
  if (avgSpend > 0) {
    const monthsCovered = liquid / avgSpend;
    components.push({
      key: "emergency",
      label: "Emergency fund",
      score: clampScore((monthsCovered / 6) * 100),
      weight: 25,
      value: `${monthsCovered.toFixed(1)} months`,
      detail: `Liquid balance ÷ average monthly spend. 6 months of runway scores 100.`,
    });
  } else {
    components.push({
      key: "emergency",
      label: "Emergency fund",
      score: 50,
      weight: 25,
      value: "—",
      detail: "Needs a month of spending history to measure runway.",
    });
  }

  // 3. Debt load — credit-card outstanding vs a month of income (or spend).
  const ccOutstanding = roundMoney(
    input.accounts
      .filter((account) => account.type === "credit_card" && !account.archived)
      .reduce((sum, account) => sum + Math.max(0, account.balance), 0),
  );
  const debtBase = totalIncome > 0 ? totalIncome / 3 : avgSpend;
  const debtRatio = debtBase > 0 ? ccOutstanding / debtBase : 0;
  components.push({
    key: "debt",
    label: "Debt load",
    score: clampScore((1 - debtRatio) * 100),
    weight: 20,
    value: ccOutstanding > 0 ? `${Math.round(debtRatio * 100)}% of a month` : "None",
    detail: `Card balances ÷ one month of ${totalIncome > 0 ? "income" : "spending"}. Zero debt scores 100; a full month's worth scores 0.`,
  });

  // 4. Diversification — 1 − HHI across holdings.
  const portfolio = buildPortfolio(input.accounts, input.expenses);
  if (portfolio.currentValue > 0 && portfolio.holdings.length > 0) {
    const hhi = portfolio.holdings.reduce((sum, holding) => {
      const share = holding.currentValue / portfolio.currentValue;
      return sum + share * share;
    }, 0);
    components.push({
      key: "diversification",
      label: "Diversification",
      score: clampScore((1 - hhi) * 100 + 25),
      weight: 10,
      value: `${portfolio.holdings.length} holdings`,
      detail:
        "Concentration (Herfindahl) across holdings — many balanced holdings score higher than one big bet.",
    });
  } else {
    components.push({
      key: "diversification",
      label: "Diversification",
      score: 30,
      weight: 10,
      value: "No investments",
      detail: "Start investing to build this score.",
    });
  }

  // 5. Budget discipline — categories within budget this month.
  const currentMonthKey = monthOf(today);
  const budgetRows = categoryBudgetSummaries(
    input.expenses,
    input.budgets,
    currentMonthKey,
  );
  if (input.budgets.monthlyBudget > 0 || budgetRows.length > 0) {
    const over = budgetRows.filter((row) => row.overBudget).length;
    const within = budgetRows.length - over;
    const share = budgetRows.length > 0 ? within / budgetRows.length : 1;
    components.push({
      key: "budget",
      label: "Budget discipline",
      score: clampScore(share * 100),
      weight: 10,
      value:
        budgetRows.length > 0 ? `${within}/${budgetRows.length} within` : "On track",
      detail: "Share of budgeted categories still within their limit this month.",
    });
  } else {
    components.push({
      key: "budget",
      label: "Budget discipline",
      score: 40,
      weight: 10,
      value: "No budget",
      detail: "Set a monthly budget to score this.",
    });
  }

  // 6. Cushion — headroom until the lowest projected liquid point.
  const recentCutoff = addDays(today, -90);
  const hasRecentActivity = input.expenses.some(
    (row) => row.date >= recentCutoff,
  );
  const cushionScore =
    avgSpend > 0 ? clampScore((liquid / avgSpend / 2) * 100) : 50;
  components.push({
    key: "cushion",
    label: "Cash cushion",
    score: cushionScore,
    weight: 10,
    value: avgSpend > 0 ? `${(liquid / avgSpend).toFixed(1)}× monthly spend` : "—",
    detail:
      "Liquid cash vs monthly spending — two months of headroom scores 100. See the 90-day forecast for the day-by-day view.",
  });

  const totalWeight = components.reduce((sum, item) => sum + item.weight, 0);
  const score = clampScore(
    components.reduce((sum, item) => sum + item.score * item.weight, 0) /
      totalWeight,
  );

  return {
    score,
    components,
    thin: activeSpendMonths.length < 2 || !hasRecentActivity,
  };
}
