"use client";

/**
 * The finance copilot.
 *
 * A bounded agent loop: the model asks for data through read-only tools, we
 * compute the answers from the real ledger, and it narrates. The user sees
 * both halves — the prose *and* the queries behind it — so any claim can be
 * opened in the expenses list and checked.
 *
 * The loop is capped rather than open-ended. Every extra round trip costs the
 * user money and latency, and in practice a finance question that needs more
 * than four lookups is a question that should be asked more narrowly.
 */

import { formatMoney } from "@/lib/domain/money";
import { todayISO } from "@/lib/domain/dates";
import { ledgerQuerySchema, type LedgerQuery } from "@/lib/domain/query";
import { streamAi } from "../client";
import { copilotPrompt } from "../prompts";
import { featureId } from "../prompts/registry";
import {
  AiError,
  type AiMessage,
  type AiPart,
} from "../provider";
import { runTool, TOOL_DEFINITIONS, type LedgerContext } from "../tools";

const MAX_ROUNDS = 4;

/** A tool the copilot ran, surfaced so the user can verify the answer. */
export interface Evidence {
  tool: string;
  label: string;
  /** Present for transaction queries — lets the UI deep-link to the list. */
  query?: LedgerQuery;
}

export interface CopilotMessage {
  role: "user" | "assistant";
  text: string;
  evidence?: Evidence[];
}

export interface CopilotAnswer {
  text: string;
  evidence: Evidence[];
  model: string;
  rounds: number;
}

export interface AskOptions {
  question: string;
  /** Prior turns, oldest first. Trimmed internally to bound prompt growth. */
  history: CopilotMessage[];
  context: LedgerContext;
  signal?: AbortSignal;
  /** Streamed answer text. */
  onDelta?: (delta: string) => void;
  /** Narrates what the copilot is doing between tool calls. */
  onStep?: (label: string) => void;
}

/** How many prior turns to replay. Enough for follow-ups, not for drift. */
const HISTORY_TURNS = 6;

function accountSummary(context: LedgerContext): string {
  const currency = context.data.settings.currency;
  const active = context.data.accounts.filter((account) => !account.archived);
  if (!active.length) return "(no accounts yet)";
  return active
    .map(
      (account) =>
        `- ${account.name} (${account.type}, id ${account.id}): ${formatMoney(account.balance, currency)}`,
    )
    .join("\n");
}

/** Human label for a tool call, shown live while it runs. */
function stepLabel(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "query_transactions": {
      const intent = typeof args.intent === "string" ? args.intent : "total";
      const category = typeof args.category === "string" ? ` in ${args.category}` : "";
      return `Querying transactions (${intent}${category})`;
    }
    case "get_accounts":
      return "Reading account balances";
    case "get_net_worth":
      return "Reading net worth";
    case "get_cash_flow_forecast":
      return "Projecting cash flow";
    case "get_financial_health":
      return "Reading health score";
    case "get_budget_status":
      return "Checking budgets";
    case "get_subscriptions":
      return "Listing subscriptions";
    case "get_portfolio":
      return "Reading portfolio";
    case "get_upcoming_bills":
      return "Checking upcoming bills";
    case "get_anomalies":
      return "Scanning for anomalies";
    default:
      return `Running ${name}`;
  }
}

function evidenceFor(
  name: string,
  args: Record<string, unknown>,
  output: Record<string, unknown>,
): Evidence {
  if (name === "query_transactions") {
    const applied = output.appliedQuery;
    const parsed = ledgerQuerySchema.safeParse(applied ?? args);
    return {
      tool: name,
      label: typeof output.summary === "string" ? output.summary.split("\n")[0] : "Transaction query",
      query: parsed.success ? parsed.data : undefined,
    };
  }
  return { tool: name, label: stepLabel(name, args) };
}

function toHistory(messages: CopilotMessage[]): AiMessage[] {
  return messages.slice(-HISTORY_TURNS).map((message) => ({
    role: message.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: message.text }],
  }));
}

/**
 * Ask the copilot a question.
 *
 * Throws `AiError`; the caller decides how to surface it.
 */
export async function askCopilot(options: AskOptions): Promise<CopilotAnswer> {
  const { context } = options;
  const feature = featureId(copilotPrompt);

  const messages: AiMessage[] = [
    ...toHistory(options.history),
    {
      role: "user",
      parts: [
        {
          text: [
            copilotPrompt.render({
              currency: context.data.settings.currency,
              today: todayISO(context.now),
              accountSummary: accountSummary(context),
            }),
            "",
            `Question: ${options.question}`,
          ].join("\n"),
        },
      ],
    },
  ];

  const evidence: Evidence[] = [];
  let text = "";
  let model = "";

  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    const result = await streamAi(
      {
        feature,
        tier: copilotPrompt.tier,
        system: copilotPrompt.system,
        messages,
        tools: TOOL_DEFINITIONS,
        temperature: copilotPrompt.temperature,
        thinking: copilotPrompt.thinking,
        signal: options.signal,
      },
      (delta) => options.onDelta?.(delta),
    );
    model = result.model;

    if (result.functionCalls.length === 0) {
      text = result.text;
      return { text, evidence, model, rounds: round };
    }

    // Replay the model's tool request, then answer it. Gemini requires both
    // halves to be present in the transcript for the next turn to make sense.
    messages.push({
      role: "model",
      parts: result.functionCalls.map<AiPart>((call) => ({ functionCall: call })),
    });

    const responses: AiPart[] = [];
    for (const call of result.functionCalls) {
      options.onStep?.(stepLabel(call.name, call.args));
      const output = runTool(call.name, call.args, context);
      evidence.push(evidenceFor(call.name, call.args, output));
      responses.push({ functionResponse: { name: call.name, response: output } });
    }
    messages.push({ role: "user", parts: responses });

    if (result.text) text = result.text;
  }

  if (text) return { text, evidence, model, rounds: MAX_ROUNDS };
  throw new AiError(
    "That needed more lookups than I'm allowed in one go — try asking something narrower.",
    "response",
  );
}

/** Starter questions shown on an empty copilot screen. */
export const COPILOT_SUGGESTIONS = [
  "Where did my money go this month?",
  "Am I going to run out of cash before my salary?",
  "What's my biggest waste right now?",
  "How does this month compare to last month?",
  "What subscriptions am I paying for?",
  "How is my portfolio doing?",
];
