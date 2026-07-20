"use client";

/**
 * Advisory features: the layer that turns computed facts into judgement.
 *
 * Each function follows the same shape — gather deterministic facts from
 * `lib/domain`, hand them to a template, validate the structured reply. The
 * model contributes prioritisation and prose; it never contributes a figure.
 *
 * Every result is cached against its inputs, because these are read on screen
 * load and would otherwise bill the user for re-rendering a page.
 */

import { detectAnomalies } from "@/lib/domain/anomalies";
import { resolveBrand } from "@/lib/brands/registry";
import { budgetSummary } from "@/lib/domain/budget";
import { currentMonth, todayISO } from "@/lib/domain/dates";
import { projectCashFlow } from "@/lib/domain/forecast";
import { healthReport, type HealthReport } from "@/lib/domain/health";
import { formatMoney } from "@/lib/domain/money";
import { buildMonthlyReview } from "@/lib/domain/review";
import { monthExpenses } from "@/lib/domain/budget";
import { totalMonthlyCost, upcomingRenewals } from "@/lib/domain/subscriptions";
import { spendRows } from "@/lib/domain/transactions";
import { upcomingEvents } from "@/lib/domain/upcoming";
import type { LedgerData } from "@/lib/storage/repository";
import { TTL } from "../cache";
import { runAi, runJson } from "../client";
import {
  briefingPrompt,
  explainPrompt,
  healthAdvicePrompt,
  insightsPrompt,
} from "../prompts";
import { featureId } from "../prompts/registry";
import { userText } from "../provider";
import {
  healthAdviceSchema,
  HEALTH_ADVICE_JSON_SCHEMA,
  insightsSchema,
  INSIGHTS_JSON_SCHEMA,
  type HealthAdvice,
  type InsightFindings,
} from "../schemas";

export interface AdvisorContext {
  data: LedgerData;
  now: Date;
  signal?: AbortSignal;
}

/* ------------------------------------------------------------------ */
/* Financial health advice                                            */
/* ------------------------------------------------------------------ */

export interface HealthAdviceResult {
  report: HealthReport;
  advice: HealthAdvice;
}

/**
 * Rank what to fix next.
 *
 * The score itself is computed by `healthReport`; the model only decides
 * which of the six components deserves the user's attention first and why.
 */
export async function adviseOnHealth(
  context: AdvisorContext,
): Promise<HealthAdviceResult> {
  const report = healthReport(
    {
      expenses: context.data.expenses,
      accounts: context.data.accounts,
      budgets: context.data.budgets,
    },
    context.now,
  );

  const { value } = await runJson(
    {
      feature: featureId(healthAdvicePrompt),
      tier: healthAdvicePrompt.tier,
      system: healthAdvicePrompt.system,
      thinking: healthAdvicePrompt.thinking,
      temperature: healthAdvicePrompt.temperature,
      schema: HEALTH_ADVICE_JSON_SCHEMA,
      messages: [
        userText(
          healthAdvicePrompt.render({
            report,
            currency: context.data.settings.currency,
          }),
        ),
      ],
      cacheTtlSeconds: TTL.medium,
      signal: context.signal,
    },
    healthAdviceSchema,
  );

  return { report, advice: value };
}

/* ------------------------------------------------------------------ */
/* Spending insights                                                  */
/* ------------------------------------------------------------------ */

/** Merchant totals for the month, brand-resolved so "SWIGGY*ORDER" collapses. */
function topMerchants(
  data: LedgerData,
  month: string,
): { name: string; total: number; count: number }[] {
  const totals = new Map<string, { total: number; count: number }>();
  for (const row of spendRows(monthExpenses(data.expenses, month))) {
    const brand = resolveBrand(row.description);
    const name = brand?.name ?? row.description.replace(/\d+/g, "").trim();
    if (!name) continue;
    const current = totals.get(name) ?? { total: 0, count: 0 };
    current.total += row.amount;
    current.count += 1;
    totals.set(name, current);
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
}

/**
 * Find waste, drift and lifestyle inflation.
 *
 * Complements the deterministic detectors rather than repeating them: those
 * catch what a rule can express, this catches the shape of a habit.
 */
export async function findInsights(
  context: AdvisorContext,
): Promise<InsightFindings> {
  const month = currentMonth(context.now);
  const currency = context.data.settings.currency;

  const review = buildMonthlyReview(
    {
      expenses: context.data.expenses,
      spaces: context.data.spaces,
      accounts: context.data.accounts,
      subscriptions: context.data.subscriptions,
      monthlyBudget: context.data.budgets.monthlyBudget,
      currency,
    },
    month,
  );

  const alerts = detectAnomalies(
    {
      expenses: context.data.expenses,
      subscriptions: context.data.subscriptions,
      currency,
      dismissed: context.data.inbox.dismissedAlerts,
    },
    context.now,
  );

  const { value } = await runJson(
    {
      feature: featureId(insightsPrompt),
      tier: insightsPrompt.tier,
      system: insightsPrompt.system,
      temperature: insightsPrompt.temperature,
      schema: INSIGHTS_JSON_SCHEMA,
      messages: [
        userText(
          insightsPrompt.render({
            currency,
            month: review.label,
            alerts,
            categoryChanges: review.categoryChanges.slice(0, 9).map((item) => ({
              category: item.category,
              current: item.current,
              previous: item.previous,
              changePct: item.changePct,
            })),
            subscriptions: context.data.subscriptions
              .filter((item) => item.active)
              .map((item) => ({
                name: item.name,
                amount: item.amount,
                cycle: item.billingCycle,
              })),
            topMerchants: topMerchants(context.data, month),
          }),
        ),
      ],
      cacheTtlSeconds: TTL.medium,
      signal: context.signal,
    },
    insightsSchema,
  );

  return value;
}

/* ------------------------------------------------------------------ */
/* Daily briefing                                                     */
/* ------------------------------------------------------------------ */

/**
 * Assemble the facts worth waking up to.
 *
 * Returned as text rather than JSON because it is the *prompt input*; keeping
 * it human-readable means the privacy test can assert on it directly.
 */
export function briefingFacts(data: LedgerData, now: Date): string {
  const currency = data.settings.currency;
  const lines: string[] = [];

  const budget = budgetSummary(data.expenses, data.budgets.monthlyBudget);
  if (budget.budget > 0) {
    lines.push(
      `Budget: spent ${formatMoney(budget.spent, currency)} of ${formatMoney(budget.budget, currency)}` +
        (budget.overBudget ? " — over budget." : `, ${formatMoney(budget.remaining, currency)} left.`),
    );
  }

  const forecast = projectCashFlow(
    {
      recurring: data.recurring,
      subscriptions: data.subscriptions,
      recurringInvestments: data.recurringInvestments,
      accounts: data.accounts,
    },
    30,
    now,
  );
  lines.push(
    `Liquid balance now ${formatMoney(forecast.start, currency)}; projected low over 30 days ` +
      `${formatMoney(forecast.lowest.balance, currency)} on ${forecast.lowest.date}` +
      (forecast.firstNegative ? `, going negative on ${forecast.firstNegative.date}.` : "."),
  );

  const events = upcomingEvents(
    {
      recurring: data.recurring,
      subscriptions: data.subscriptions,
      recurringInvestments: data.recurringInvestments,
      accounts: data.accounts,
    },
    7,
    now,
  );
  lines.push(
    events.length
      ? `Due in the next 7 days: ${events
          .slice(0, 6)
          .map((event) => `${event.title} ${formatMoney(event.amount, currency)} on ${event.date}`)
          .join("; ")}.`
      : "Nothing scheduled in the next 7 days.",
  );

  const renewals = upcomingRenewals(data.subscriptions.filter((item) => item.active), 14, now);
  if (renewals.length) {
    lines.push(
      `Subscriptions renewing within 14 days: ${renewals
        .map((item) => `${item.subscription.name} (${item.daysAway}d)`)
        .join(", ")}. Monthly subscription cost ${formatMoney(
        totalMonthlyCost(data.subscriptions.filter((item) => item.active)),
        currency,
      )}.`,
    );
  }

  const alerts = detectAnomalies(
    {
      expenses: data.expenses,
      subscriptions: data.subscriptions,
      currency,
      dismissed: data.inbox.dismissedAlerts,
    },
    now,
  );
  if (alerts.length) {
    lines.push(`Open alerts: ${alerts.map((alert) => alert.title).join("; ")}.`);
  }

  const drafts = data.inbox.drafts.length;
  if (drafts > 0) lines.push(`${drafts} imported transaction(s) waiting in the inbox.`);

  return lines.join("\n");
}

/** Two or three sentences for the dashboard. */
export async function buildBriefing(context: AdvisorContext): Promise<string> {
  const facts = briefingFacts(context.data, context.now);
  const result = await runAi({
    feature: featureId(briefingPrompt),
    tier: briefingPrompt.tier,
    system: briefingPrompt.system,
    temperature: briefingPrompt.temperature,
    thinking: briefingPrompt.thinking,
    messages: [
      userText(
        briefingPrompt.render({
          currency: context.data.settings.currency,
          today: todayISO(context.now),
          facts,
        }),
      ),
    ],
    // A brief is a statement about today, so it may be reused all day but
    // never across days — the date is in the prompt, so the key rolls over.
    cacheTtlSeconds: TTL.medium,
    signal: context.signal,
  });
  return result.text;
}

/* ------------------------------------------------------------------ */
/* Explain anything                                                   */
/* ------------------------------------------------------------------ */

/**
 * The generic "why is this number what it is" primitive.
 *
 * Callers pass facts they already computed, so this can sit behind any figure
 * in the app without that surface needing its own prompt.
 */
export async function explain(
  subject: string,
  facts: string,
  context: AdvisorContext,
): Promise<string> {
  const result = await runAi({
    feature: featureId(explainPrompt),
    tier: explainPrompt.tier,
    system: explainPrompt.system,
    temperature: explainPrompt.temperature,
    messages: [
      userText(
        explainPrompt.render({
          subject,
          facts,
          currency: context.data.settings.currency,
        }),
      ),
    ],
    cacheTtlSeconds: TTL.medium,
    signal: context.signal,
  });
  return result.text;
}
