/**
 * The copilot's hands.
 *
 * Every tool here is a thin adapter over a pure `lib/domain` engine. The model
 * chooses *which* question to ask and how to phrase the answer; the arithmetic
 * is always ours. That is the whole trick behind an assistant that can't
 * hallucinate a balance.
 *
 * Two rules hold for every tool:
 *  1. **Read-only.** Nothing here mutates the ledger. Writes go through the
 *     draft/confirm flow the user already trusts.
 *  2. **Compact output.** Tool results are re-sent with every subsequent turn,
 *     so they return aggregates and a handful of examples, never bulk rows.
 */

import { detectAnomalies } from "@/lib/domain/anomalies";
import {
  assetsTotal,
  liabilitiesTotal,
  netWorth,
  utilization,
} from "@/lib/domain/balances";
import { budgetSummary, categoryBudgetSummaries } from "@/lib/domain/budget";
import { projectCashFlow } from "@/lib/domain/forecast";
import { healthReport } from "@/lib/domain/health";
import { buildPortfolio, goalProgress } from "@/lib/domain/investments";
import { executeQuery, ledgerQuerySchema, summariseResult } from "@/lib/domain/query";
import { totalAnnualCost, totalMonthlyCost } from "@/lib/domain/subscriptions";
import { CATEGORIES } from "@/lib/domain/types";
import { upcomingEvents } from "@/lib/domain/upcoming";
import { TIME_PRESETS } from "@/lib/domain/time-ranges";
import type { LedgerData } from "@/lib/storage/repository";
import type { JsonSchema, ToolDefinition } from "./provider";

export interface LedgerContext {
  data: LedgerData;
  now: Date;
}

function currencyOf(context: LedgerContext): string {
  return context.data.settings.currency;
}

/** Round for prompt compactness — sub-rupee precision is noise to a narrator. */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Schemas                                                            */
/* ------------------------------------------------------------------ */

/**
 * Hand-written OpenAPI-subset schemas rather than a Zod→JSON-Schema
 * conversion: Gemini rejects deep or exotic schemas, and the tool surface is
 * small enough that the explicit version is clearer and easier to keep
 * inside the supported subset.
 */
const QUERY_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["list", "total", "breakdown", "trend", "compare"],
      description:
        "total = one number; breakdown = split by category; trend = time series; list = the transactions; compare = this period vs another.",
    },
    rows: {
      type: "string",
      enum: ["spend", "income", "all"],
      description: "Which side of the ledger. Defaults to spend.",
    },
    preset: {
      type: "string",
      enum: [...TIME_PRESETS],
      description:
        "Time window. thisFY/lastFY are Indian financial years (Apr–Mar). Use 'custom' with start/end for anything else.",
    },
    start: { type: "string", description: "YYYY-MM-DD, only when preset is custom." },
    end: { type: "string", description: "YYYY-MM-DD, only when preset is custom." },
    comparePreset: {
      type: "string",
      enum: [...TIME_PRESETS],
      description: "The period to compare against. Required when intent is compare.",
    },
    category: { type: "string", enum: [...CATEGORIES] },
    accountId: { type: "string", description: "Account id from get_accounts." },
    spaceId: { type: "string", description: "Space (trip/project) id." },
    tags: { type: "array", items: { type: "string" } },
    text: {
      type: "string",
      description: "Free text matched against merchant, notes and brand aliases.",
    },
    groupBy: { type: "string", enum: ["category", "day", "week", "month"] },
    limit: { type: "integer", description: "Max rows to return (default 25)." },
  },
};

const EMPTY_SCHEMA: JsonSchema = { type: "object", properties: {} };

const FORECAST_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    horizonDays: {
      type: "integer",
      description: "How far ahead to project, 1–365. Defaults to 90.",
    },
  },
};

const UPCOMING_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    withinDays: { type: "integer", description: "Look-ahead window, defaults to 45." },
  },
};

/* ------------------------------------------------------------------ */
/* Tool implementations                                               */
/* ------------------------------------------------------------------ */

type ToolFn = (
  args: Record<string, unknown>,
  context: LedgerContext,
) => Record<string, unknown>;

interface Tool {
  definition: ToolDefinition;
  run: ToolFn;
}

const queryTransactions: Tool = {
  definition: {
    name: "query_transactions",
    description:
      "Answer any question about what was spent or earned: totals, category breakdowns, trends over time, period comparisons, or the transactions themselves. This is the primary tool — prefer it over guessing.",
    parameters: QUERY_SCHEMA,
  },
  run: (args, context) => {
    const query = ledgerQuerySchema.parse(args ?? {});
    const result = executeQuery(
      query,
      {
        expenses: context.data.expenses,
        accounts: context.data.accounts,
        spaces: context.data.spaces,
      },
      context.now,
    );
    return {
      summary: summariseResult(result, currencyOf(context)),
      total: money(result.total),
      count: result.count,
      appliedQuery: result.query,
    };
  },
};

const getAccounts: Tool = {
  definition: {
    name: "get_accounts",
    description:
      "List the user's accounts with current balances, types, credit limits and utilisation. Use this to resolve an account name to an id before querying transactions.",
    parameters: EMPTY_SCHEMA,
  },
  run: (_args, context) => ({
    currency: currencyOf(context),
    accounts: context.data.accounts
      .filter((account) => !account.archived)
      .map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        balance: money(account.balance),
        creditLimit: account.creditLimit ?? null,
        utilisationPercent: utilization(account),
        statementDueDate: account.statementDueDate ?? null,
      })),
  }),
};

const getNetWorth: Tool = {
  definition: {
    name: "get_net_worth",
    description:
      "Current net worth, assets, liabilities, and the monthly net-worth history captured from snapshots.",
    parameters: EMPTY_SCHEMA,
  },
  run: (_args, context) => ({
    currency: currencyOf(context),
    netWorth: money(netWorth(context.data.accounts)),
    assets: money(assetsTotal(context.data.accounts)),
    liabilities: money(liabilitiesTotal(context.data.accounts)),
    history: context.data.snapshots.slice(-12).map((snapshot) => ({
      month: snapshot.month,
      netWorth: money(snapshot.netWorth),
    })),
  }),
};

const getForecast: Tool = {
  definition: {
    name: "get_cash_flow_forecast",
    description:
      "Project the combined liquid balance forward from every known schedule: recurring bills, income, subscriptions, SIPs and credit-card dues. Answers 'will I run out of money', 'what will my balance be', 'can I afford X'.",
    parameters: FORECAST_SCHEMA,
  },
  run: (args, context) => {
    const horizon = Math.min(
      365,
      Math.max(1, Number(args.horizonDays) || 90),
    );
    const forecast = projectCashFlow(
      {
        recurring: context.data.recurring,
        subscriptions: context.data.subscriptions,
        recurringInvestments: context.data.recurringInvestments,
        accounts: context.data.accounts,
      },
      horizon,
      context.now,
    );
    return {
      currency: currencyOf(context),
      horizonDays: horizon,
      startingBalance: money(forecast.start),
      totalIn: money(forecast.totalIn),
      totalOut: money(forecast.totalOut),
      lowestPoint: {
        date: forecast.lowest.date,
        balance: money(forecast.lowest.balance),
      },
      firstNegativeDate: forecast.firstNegative?.date ?? null,
      endingBalance: money(
        forecast.points[forecast.points.length - 1]?.balance ?? forecast.start,
      ),
    };
  },
};

const getHealth: Tool = {
  definition: {
    name: "get_financial_health",
    description:
      "The financial health score with its six weighted components (savings rate, emergency fund, debt load, diversification, budget discipline, cash cushion). Each component carries the formula behind it — quote those rather than inventing your own.",
    parameters: EMPTY_SCHEMA,
  },
  run: (_args, context) => {
    const report = healthReport(
      {
        expenses: context.data.expenses,
        accounts: context.data.accounts,
        budgets: context.data.budgets,
      },
      context.now,
    );
    return {
      score: report.score,
      thinData: report.thin,
      components: report.components.map((component) => ({
        label: component.label,
        score: component.score,
        weight: component.weight,
        value: component.value,
        formula: component.detail,
      })),
    };
  },
};

const getBudgets: Tool = {
  definition: {
    name: "get_budget_status",
    description:
      "This month's overall and per-category budget usage, including which categories are near or over their limit.",
    parameters: EMPTY_SCHEMA,
  },
  run: (_args, context) => {
    const overall = budgetSummary(
      context.data.expenses,
      context.data.budgets.monthlyBudget,
    );
    return {
      currency: currencyOf(context),
      overall: {
        budget: money(overall.budget),
        spent: money(overall.spent),
        remaining: money(overall.remaining),
        overBudget: overall.overBudget,
      },
      categories: categoryBudgetSummaries(
        context.data.expenses,
        context.data.budgets,
      ).map((item) => ({
        category: item.category,
        budget: money(item.budget),
        spent: money(item.spent),
        remaining: money(item.remaining),
        nearLimit: item.nearLimit,
        overBudget: item.overBudget,
      })),
    };
  },
};

const getSubscriptions: Tool = {
  definition: {
    name: "get_subscriptions",
    description:
      "Tracked recurring subscriptions with their cost, billing cycle and next renewal date, plus monthly and annual totals.",
    parameters: EMPTY_SCHEMA,
  },
  run: (_args, context) => {
    const active = context.data.subscriptions.filter((item) => item.active);
    return {
      currency: currencyOf(context),
      monthlyTotal: money(totalMonthlyCost(active)),
      annualTotal: money(totalAnnualCost(active)),
      subscriptions: active.map((item) => ({
        name: item.name,
        amount: money(item.amount),
        billingCycle: item.billingCycle,
        category: item.category,
        nextRenewalDate: item.nextRenewalDate,
      })),
    };
  },
};

const getPortfolio: Tool = {
  definition: {
    name: "get_portfolio",
    description:
      "Investment holdings with amount invested, current market value and gain, plus goal progress. Use for diversification, concentration and performance questions.",
    parameters: EMPTY_SCHEMA,
  },
  run: (_args, context) => {
    const portfolio = buildPortfolio(context.data.accounts, context.data.expenses);
    return {
      currency: currencyOf(context),
      invested: money(portfolio.invested),
      currentValue: money(portfolio.currentValue),
      gain: money(portfolio.gain),
      gainPercent: portfolio.gainPercent,
      holdings: portfolio.holdings.map((holding) => ({
        name: holding.account.name,
        assetType: holding.account.assetType ?? "other",
        invested: money(holding.invested),
        currentValue: money(holding.currentValue),
        gainPercent: holding.gainPercent,
        sharePercent:
          portfolio.currentValue > 0
            ? Math.round((holding.currentValue / portfolio.currentValue) * 100)
            : 0,
      })),
      goals: context.data.goals.map((goal) => {
        const progress = goalProgress(goal, context.data.accounts, context.data.expenses);
        return {
          name: goal.name,
          target: money(progress.target),
          current: money(progress.current),
          progressPercent: Math.round(progress.progress * 100),
          targetDate: goal.targetDate ?? null,
        };
      }),
    };
  },
};

const getUpcoming: Tool = {
  definition: {
    name: "get_upcoming_bills",
    description:
      "Scheduled money movements in the near future: recurring bills, income, subscription renewals, SIPs and credit-card dues.",
    parameters: UPCOMING_SCHEMA,
  },
  run: (args, context) => {
    const within = Math.min(365, Math.max(1, Number(args.withinDays) || 45));
    const events = upcomingEvents(
      {
        recurring: context.data.recurring,
        subscriptions: context.data.subscriptions,
        recurringInvestments: context.data.recurringInvestments,
        accounts: context.data.accounts,
      },
      within,
      context.now,
    );
    return {
      currency: currencyOf(context),
      withinDays: within,
      events: events.slice(0, 40).map((event) => ({
        date: event.date,
        title: event.title,
        amount: money(event.amount),
        type: event.type,
      })),
    };
  },
};

const getAnomalies: Tool = {
  definition: {
    name: "get_anomalies",
    description:
      "Detected problems: likely duplicate charges, subscription price hikes, and categories running far above their three-month average. Each alert already carries its evidence.",
    parameters: EMPTY_SCHEMA,
  },
  run: (_args, context) => ({
    alerts: detectAnomalies(
      {
        expenses: context.data.expenses,
        subscriptions: context.data.subscriptions,
        currency: currencyOf(context),
        dismissed: context.data.inbox.dismissedAlerts,
      },
      context.now,
    ).map((alert) => ({
      severity: alert.severity,
      title: alert.title,
      detail: alert.detail,
    })),
  }),
};

const TOOLS: Tool[] = [
  queryTransactions,
  getAccounts,
  getNetWorth,
  getForecast,
  getHealth,
  getBudgets,
  getSubscriptions,
  getPortfolio,
  getUpcoming,
  getAnomalies,
];

export const TOOL_DEFINITIONS: ToolDefinition[] = TOOLS.map((tool) => tool.definition);

const BY_NAME = new Map(TOOLS.map((tool) => [tool.definition.name, tool]));

export function toolNames(): string[] {
  return [...BY_NAME.keys()];
}

/**
 * Execute one model-requested tool call.
 *
 * A thrown error is returned as data rather than propagated: the model can
 * recover from "that account id doesn't exist" by trying again, whereas an
 * exception would kill the whole conversation turn.
 */
export function runTool(
  name: string,
  args: Record<string, unknown>,
  context: LedgerContext,
): Record<string, unknown> {
  const tool = BY_NAME.get(name);
  if (!tool) {
    return { error: `Unknown tool "${name}". Available: ${toolNames().join(", ")}.` };
  }
  try {
    return tool.run(args ?? {}, context);
  } catch (error) {
    return {
      error: `${name} failed: ${(error as Error).message}`,
      hint: "Check the argument shape and try again, or answer without this tool.",
    };
  }
}
