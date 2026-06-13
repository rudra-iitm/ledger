import type { Category, Expense } from "./types";
import { currentMonth, monthOf, previousMonth } from "./dates";
import { roundMoney } from "./money";
import { breakdownByCategory, totalSpending } from "./analytics";
import { isSpend } from "./transactions";

export type InsightTone = "neutral" | "positive" | "negative";

export interface Insight {
  id: string;
  label: string;
  value: string;
  detail?: string;
  tone: InsightTone;
}

function expensesInMonth(expenses: Expense[], month: string): Expense[] {
  return expenses.filter(
    (expense) => isSpend(expense) && monthOf(expense.date) === month,
  );
}

export function buildInsights(
  expenses: Expense[],
  currency: string,
  now: Date = new Date(),
): Insight[] {
  const money = (value: number) => `${currency}${Math.round(value).toLocaleString("en-IN")}`;
  const month = currentMonth(now);
  const prev = previousMonth(month);
  const thisMonth = expensesInMonth(expenses, month);
  const lastMonth = expensesInMonth(expenses, prev);

  const insights: Insight[] = [];

  const thisTotal = totalSpending(thisMonth);
  const lastTotal = totalSpending(lastMonth);

  const topCategory = breakdownByCategory(thisMonth)[0];
  if (topCategory) {
    insights.push({
      id: "top-category",
      label: "Top category this month",
      value: topCategory.category,
      detail: `${money(topCategory.total)} · ${Math.round(topCategory.percentage)}% of spend`,
      tone: "neutral",
    });
  }

  if (lastTotal > 0) {
    const change = thisTotal - lastTotal;
    const pct = Math.round((change / lastTotal) * 100);
    if (change > 0) {
      insights.push({
        id: "trend",
        label: "vs last month",
        value: `+${pct}%`,
        detail: `${money(change)} more than ${money(lastTotal)}`,
        tone: "negative",
      });
    } else if (change < 0) {
      insights.push({
        id: "trend",
        label: "vs last month",
        value: `${pct}%`,
        detail: `${money(Math.abs(change))} less than ${money(lastTotal)}`,
        tone: "positive",
      });
    } else {
      insights.push({
        id: "trend",
        label: "vs last month",
        value: "No change",
        tone: "neutral",
      });
    }
  }

  const largest = [...thisMonth].sort((a, b) => b.amount - a.amount)[0];
  if (largest) {
    insights.push({
      id: "largest",
      label: "Largest transaction",
      value: money(largest.amount),
      detail: largest.description,
      tone: "neutral",
    });
  }

  if (thisMonth.length > 0) {
    const day = now.getDate();
    insights.push({
      id: "avg-daily",
      label: "Average daily spend",
      value: money(roundMoney(thisTotal / day)),
      detail: "This month so far",
      tone: "neutral",
    });
    insights.push({
      id: "avg-weekly",
      label: "Average weekly spend",
      value: money(roundMoney((thisTotal / day) * 7)),
      tone: "neutral",
    });
  }

  return insights;
}

export function categoryTrend(
  expenses: Expense[],
  category: Category,
  now: Date = new Date(),
): number {
  const month = currentMonth(now);
  const prev = previousMonth(month);
  const thisTotal = totalSpending(
    expensesInMonth(expenses, month).filter((e) => e.category === category),
  );
  const lastTotal = totalSpending(
    expensesInMonth(expenses, prev).filter((e) => e.category === category),
  );
  if (lastTotal === 0) return thisTotal > 0 ? 100 : 0;
  return Math.round(((thisTotal - lastTotal) / lastTotal) * 100);
}
