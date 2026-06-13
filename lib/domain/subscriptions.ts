import type { BillingCycle, Expense, Subscription } from "./types";
import { addDays, addMonthsClamped, addYears, parseISODate, todayISO } from "./dates";
import { roundMoney } from "./money";
import { createId } from "./id";

export function advanceRenewal(date: string, cycle: BillingCycle): string {
  const day = parseISODate(date).getDate();
  switch (cycle) {
    case "weekly":
      return addDays(date, 7);
    case "monthly":
      return addMonthsClamped(date, 1, day);
    case "quarterly":
      return addMonthsClamped(date, 3, day);
    case "yearly":
      return addYears(date, 1);
    default:
      return addMonthsClamped(date, 1, day);
  }
}

export function monthlyCost(subscription: Subscription): number {
  switch (subscription.billingCycle) {
    case "weekly":
      return roundMoney((subscription.amount * 52) / 12);
    case "monthly":
      return roundMoney(subscription.amount);
    case "quarterly":
      return roundMoney(subscription.amount / 3);
    case "yearly":
      return roundMoney(subscription.amount / 12);
    default:
      return roundMoney(subscription.amount);
  }
}

export function annualCost(subscription: Subscription): number {
  return roundMoney(monthlyCost(subscription) * 12);
}

export function totalMonthlyCost(subscriptions: Subscription[]): number {
  return roundMoney(
    subscriptions
      .filter((subscription) => subscription.active)
      .reduce((total, subscription) => total + monthlyCost(subscription), 0),
  );
}

export function totalAnnualCost(subscriptions: Subscription[]): number {
  return roundMoney(totalMonthlyCost(subscriptions) * 12);
}

export function daysUntil(date: string, now: Date = new Date()): number {
  const today = parseISODate(todayISO(now)).getTime();
  const target = parseISODate(date).getTime();
  return Math.round((target - today) / 86_400_000);
}

export interface UpcomingRenewal {
  subscription: Subscription;
  daysAway: number;
}

export function upcomingRenewals(
  subscriptions: Subscription[],
  withinDays: number,
  now: Date = new Date(),
): UpcomingRenewal[] {
  return subscriptions
    .filter((subscription) => subscription.active)
    .map((subscription) => ({
      subscription,
      daysAway: daysUntil(subscription.nextRenewalDate, now),
    }))
    .filter((entry) => entry.daysAway >= 0 && entry.daysAway <= withinDays)
    .sort((a, b) => a.daysAway - b.daysAway);
}

export function recentlyRenewed(
  subscriptions: Subscription[],
  withinDays: number,
  now: Date = new Date(),
): UpcomingRenewal[] {
  return subscriptions
    .filter((subscription) => subscription.active)
    .map((subscription) => ({
      subscription,
      daysAway: daysUntil(subscription.nextRenewalDate, now),
    }))
    .filter((entry) => entry.daysAway < 0 && entry.daysAway >= -withinDays)
    .sort((a, b) => b.daysAway - a.daysAway);
}

export interface SubscriptionMaterialization {
  newExpenses: Expense[];
  updatedSubscriptions: Subscription[];
  changed: boolean;
}

export function materializeSubscriptions(
  subscriptions: Subscription[],
  now: Date = new Date(),
): SubscriptionMaterialization {
  const today = todayISO(now);
  const newExpenses: Expense[] = [];
  let changed = false;

  const updatedSubscriptions = subscriptions.map((subscription) => {
    if (!subscription.active) return subscription;
    let renewal = subscription.nextRenewalDate;
    let guard = 0;
    let touched = false;
    while (renewal <= today && guard < 1000) {
      newExpenses.push({
        id: createId(),
        type: "expense" as const,
        description: subscription.name,
        amount: subscription.amount,
        category: subscription.category,
        date: renewal,
        createdAt: now.toISOString(),
        subscriptionId: subscription.id,
        accountId: subscription.accountId,
        affectsBalance: true,
        tags: [],
        attachments: [],
      });
      renewal = advanceRenewal(renewal, subscription.billingCycle);
      touched = true;
      guard += 1;
    }
    if (!touched) return subscription;
    changed = true;
    return { ...subscription, nextRenewalDate: renewal };
  });

  return { newExpenses, updatedSubscriptions, changed };
}
