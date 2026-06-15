import type {
  Account,
  RecurringExpense,
  RecurringInvestment,
  Subscription,
} from "./types";
import { nextDueDate } from "./recurring";
import { nextInvestmentDate } from "./recurring-investments";
import { addDays, todayISO } from "./dates";

export type UpcomingType =
  | "expense"
  | "income"
  | "transfer"
  | "cc_payment"
  | "subscription"
  | "investment"
  | "cc_due";

export interface UpcomingEvent {
  id: string;
  date: string;
  title: string;
  amount: number;
  type: UpcomingType;
}

export interface UpcomingInput {
  recurring: RecurringExpense[];
  subscriptions: Subscription[];
  recurringInvestments: RecurringInvestment[];
  accounts: Account[];
}

export function upcomingEvents(
  input: UpcomingInput,
  withinDays = 45,
  now: Date = new Date(),
): UpcomingEvent[] {
  const today = todayISO(now);
  const horizon = addDays(today, withinDays);
  const events: UpcomingEvent[] = [];

  for (const item of input.recurring) {
    if (!item.active) continue;
    const date = nextDueDate(item, now);
    events.push({
      id: `rec-${item.id}`,
      date,
      title: item.description,
      amount: item.amount,
      type: item.kind ?? "expense",
    });
  }

  for (const subscription of input.subscriptions) {
    if (!subscription.active) continue;
    events.push({
      id: `sub-${subscription.id}`,
      date: subscription.nextRenewalDate,
      title: subscription.name,
      amount: subscription.amount,
      type: "subscription",
    });
  }

  for (const item of input.recurringInvestments) {
    if (!item.active) continue;
    events.push({
      id: `inv-${item.id}`,
      date: nextInvestmentDate(item, now),
      title: item.name,
      amount: item.amount,
      type: "investment",
    });
  }

  for (const account of input.accounts) {
    if (account.type !== "credit_card" || account.archived) continue;
    if (!account.statementDueDate) continue;
    const outstanding = Math.max(0, account.balance);
    if (outstanding <= 0) continue;
    events.push({
      id: `due-${account.id}`,
      date: account.statementDueDate,
      title: `${account.name} bill`,
      amount: account.minimumDue ?? account.statementBalance ?? outstanding,
      type: "cc_due",
    });
  }

  return events
    .filter((event) => event.date >= today && event.date <= horizon)
    .sort((a, b) =>
      a.date === b.date ? a.title.localeCompare(b.title) : a.date.localeCompare(b.date),
    );
}

export function upcomingDateSet(events: UpcomingEvent[]): Set<string> {
  return new Set(events.map((event) => event.date));
}
