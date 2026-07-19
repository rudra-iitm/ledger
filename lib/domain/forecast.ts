import type { Account, AccountType } from "./types";
import { addDays, todayISO } from "./dates";
import { roundMoney } from "./money";
import { advance, nextDueDate } from "./recurring";
import { advanceInvestment, nextInvestmentDate } from "./recurring-investments";
import { advanceRenewal } from "./subscriptions";
import type { UpcomingInput } from "./upcoming";

export interface ForecastPoint {
  date: string;
  balance: number;
}

export interface CashFlowForecast {
  start: number;
  points: ForecastPoint[];
  lowest: ForecastPoint;
  firstNegative: ForecastPoint | null;
  totalIn: number;
  totalOut: number;
}

export const LIQUID_TYPES: AccountType[] = [
  "cash",
  "bank",
  "wallet",
  "debit_card",
  "other",
];

const MAX_STEPS = 400;

export function isLiquid(account: Account | undefined): boolean {
  // Unknown accounts default to liquid so scheduled items without an
  // account still show up in the projection.
  if (!account) return true;
  return LIQUID_TYPES.includes(account.type) && !account.archived;
}

/**
 * Projects the combined liquid balance (cash/bank/wallet) over the horizon by
 * walking every schedule: recurring expenses/income/transfers/CC bills,
 * subscriptions, SIPs, and credit-card statement dues.
 */
export function projectCashFlow(
  input: UpcomingInput,
  horizonDays = 90,
  now: Date = new Date(),
): CashFlowForecast {
  const today = todayISO(now);
  const horizon = addDays(today, horizonDays);
  const accountById = new Map(input.accounts.map((item) => [item.id, item]));
  const liquidOf = (id: string | undefined) =>
    isLiquid(id ? accountById.get(id) : undefined);

  const start = roundMoney(
    input.accounts
      .filter((account) => isLiquid(account))
      .reduce((sum, account) => sum + account.balance, 0),
  );

  const deltas = new Map<string, number>();
  const add = (date: string, amount: number) => {
    if (amount === 0 || date < today || date > horizon) return;
    deltas.set(date, roundMoney((deltas.get(date) ?? 0) + amount));
  };

  for (const item of input.recurring) {
    if (!item.active) continue;
    const sourceLiquid = liquidOf(item.accountId);
    const destLiquid =
      item.kind === "transfer" ? liquidOf(item.transferAccountId) : false;
    let date = nextDueDate(item, now);
    for (let step = 0; step < MAX_STEPS && date <= horizon; step += 1) {
      switch (item.kind ?? "expense") {
        case "income":
          if (sourceLiquid) add(date, item.amount);
          break;
        case "transfer":
          // Only transfers that cross the liquid boundary move the pool.
          if (sourceLiquid && !destLiquid) add(date, -item.amount);
          else if (!sourceLiquid && destLiquid) add(date, item.amount);
          break;
        default:
          if (sourceLiquid) add(date, -item.amount);
      }
      date = advance(item, date);
    }
  }

  for (const subscription of input.subscriptions) {
    if (!subscription.active) continue;
    if (!liquidOf(subscription.accountId)) continue;
    let date = subscription.nextRenewalDate;
    for (let step = 0; step < MAX_STEPS && date <= horizon; step += 1) {
      add(date, -subscription.amount);
      date = advanceRenewal(date, subscription.billingCycle);
    }
  }

  for (const item of input.recurringInvestments) {
    if (!item.active || !item.affectsBalance) continue;
    if (!liquidOf(item.fromAccountId)) continue;
    let date = nextInvestmentDate(item, now);
    for (let step = 0; step < MAX_STEPS && date <= horizon; step += 1) {
      add(date, -item.amount);
      date = advanceInvestment(item, date);
    }
  }

  for (const account of input.accounts) {
    if (account.type !== "credit_card" || account.archived) continue;
    if (!account.statementDueDate) continue;
    const outstanding = Math.max(0, account.balance);
    if (outstanding <= 0) continue;
    add(
      account.statementDueDate,
      -(account.minimumDue ?? account.statementBalance ?? outstanding),
    );
  }

  const points: ForecastPoint[] = [];
  let running = start;
  let totalIn = 0;
  let totalOut = 0;
  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const date = addDays(today, offset);
    const delta = deltas.get(date) ?? 0;
    if (delta > 0) totalIn = roundMoney(totalIn + delta);
    if (delta < 0) totalOut = roundMoney(totalOut - delta);
    running = roundMoney(running + delta);
    points.push({ date, balance: running });
  }

  let lowest = points[0];
  let firstNegative: ForecastPoint | null = null;
  for (const point of points) {
    if (point.balance < lowest.balance) lowest = point;
    if (firstNegative === null && point.balance < 0) firstNegative = point;
  }

  return { start, points, lowest, firstNegative, totalIn, totalOut };
}
