import { beforeEach, describe, expect, it } from "vitest";
import { hashKey, prune } from "@/lib/ai/cache";
import { buildBody, isKeyProblem } from "@/lib/ai/gemini";
import { chainFor, estimateCost, MODEL_CHAINS } from "@/lib/ai/models";
import { runJson, setAiProvider } from "@/lib/ai/client";
import { summariseAiLog, type AiLogEntry } from "@/lib/ai/telemetry";
import { TokenBucket, __resetRateLimiter } from "@/lib/ai/rate-limit";
import {
  AiError,
  userText,
  type AiProvider,
  type GenerateRequest,
  type GenerateResult,
} from "@/lib/ai/provider";
// Import via the package entry point, not the registry module: templates
// register themselves as a side effect of being imported.
import { allPrompts, featureId } from "@/lib/ai/prompts";
import { runTool, TOOL_DEFINITIONS } from "@/lib/ai/tools";
import { categorizeResultSchema, documentExtractionSchema } from "@/lib/ai/schemas";
import { z } from "zod";
import { DEFAULT_ACCOUNTS, DEFAULT_BUDGETS, DEFAULT_INBOX, DEFAULT_SETTINGS } from "@/lib/domain/types";
import type { LedgerData } from "@/lib/storage/repository";

/* ------------------------------------------------------------------ */
/* Cache                                                              */
/* ------------------------------------------------------------------ */

describe("cache", () => {
  it("hashes deterministically and separates different inputs", () => {
    expect(hashKey("abc")).toBe(hashKey("abc"));
    expect(hashKey("abc")).not.toBe(hashKey("abd"));
    expect(hashKey("")).toHaveLength(16);
  });

  it("prunes expired entries and keeps the most recently used", () => {
    const now = 1_000_000;
    const map = {
      fresh: { value: 1, expiresAt: now + 1000, usedAt: now },
      stale: { value: 2, expiresAt: now - 1, usedAt: now },
      older: { value: 3, expiresAt: now + 1000, usedAt: now - 5000 },
    };
    const pruned = prune(map, now);
    expect(Object.keys(pruned).sort()).toEqual(["fresh", "older"]);
  });
});

/* ------------------------------------------------------------------ */
/* Model routing                                                      */
/* ------------------------------------------------------------------ */

describe("model routing", () => {
  it("gives every tier a fallback chain, not a single id", () => {
    for (const [tier, chain] of Object.entries(MODEL_CHAINS)) {
      expect(chain.length, `${tier} needs a fallback`).toBeGreaterThan(1);
    }
  });

  it("leads each chain with a -latest alias so retired ids can't break a feature", () => {
    for (const tier of ["fast", "balanced", "deep", "vision"] as const) {
      expect(chainFor(tier)[0].id).toMatch(/-latest$/);
    }
  });

  it("estimates cost from the local price table, and zero for unknown models", () => {
    expect(estimateCost("gemini-flash-latest", 1_000_000, 0)).toBeCloseTo(0.3);
    expect(estimateCost("some-future-model", 1_000_000, 1_000_000)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Request building and degradation                                   */
/* ------------------------------------------------------------------ */

describe("buildBody", () => {
  const base: GenerateRequest = {
    feature: "test",
    tier: "balanced",
    messages: [userText("hello")],
    system: "be brief",
    schema: { type: "object", properties: {} },
    thinking: "off",
  };

  it("sends schema and thinking config at full fidelity", () => {
    const body = buildBody(base) as Record<string, Record<string, unknown>>;
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema).toBeDefined();
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(body.systemInstruction).toEqual({ parts: [{ text: "be brief" }] });
  });

  it("sheds one field per degradation level", () => {
    const first = buildBody(base, 1) as Record<string, Record<string, unknown>>;
    expect(first.generationConfig.thinkingConfig).toBeUndefined();
    expect(first.generationConfig.responseSchema).toBeDefined();

    const second = buildBody(base, 2) as Record<string, Record<string, unknown>>;
    expect(second.generationConfig.responseSchema).toBeUndefined();
    expect(second.generationConfig.responseMimeType).toBe("application/json");

    const third = buildBody(base, 3) as Record<string, Record<string, unknown>>;
    expect(third.generationConfig.responseMimeType).toBeUndefined();
  });

  it("never sends a response schema alongside tools — Gemini rejects the pair", () => {
    const body = buildBody({
      ...base,
      tools: [{ name: "t", description: "d", parameters: { type: "object" } }],
    }) as Record<string, Record<string, unknown>>;
    expect(body.generationConfig.responseSchema).toBeUndefined();
    expect(body.generationConfig.responseMimeType).toBeUndefined();
    expect(body.tools).toBeDefined();
  });
});

describe("error classification", () => {
  // Gemini answers a bad key with 400, not 401/403 — verified against the
  // live API. Classifying it as a generic response error hides the only
  // action that fixes it, so this is pinned.
  it("recognises a bad key behind a 400", () => {
    expect(isKeyProblem(400, "API key not valid. Please pass a valid API key.")).toBe(true);
    expect(isKeyProblem(400, "API_KEY_INVALID")).toBe(true);
    expect(isKeyProblem(403, "Permission denied")).toBe(true);
    expect(isKeyProblem(401, "invalid api-key")).toBe(true);
  });

  it("does not mistake an ordinary bad request for a key problem", () => {
    expect(isKeyProblem(400, "Invalid JSON payload received. Unknown name thinkingConfig")).toBe(
      false,
    );
    expect(isKeyProblem(429, "Resource exhausted")).toBe(false);
    expect(isKeyProblem(500, "Internal error")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Rate limiting                                                      */
/* ------------------------------------------------------------------ */

describe("TokenBucket", () => {
  it("allows a burst up to capacity then refuses", () => {
    const clock = 0;
    const bucket = new TokenBucket({ capacity: 3, refillPerSecond: 1, now: () => clock });
    expect(bucket.tryTake()).toBe(true);
    expect(bucket.tryTake()).toBe(true);
    expect(bucket.tryTake()).toBe(true);
    expect(bucket.tryTake()).toBe(false);
  });

  it("refills over time and reports the wait accurately", () => {
    let clock = 0;
    const bucket = new TokenBucket({ capacity: 2, refillPerSecond: 2, now: () => clock });
    bucket.tryTake();
    bucket.tryTake();
    expect(bucket.tryTake()).toBe(false);
    expect(bucket.waitMs()).toBe(500);
    clock += 500;
    expect(bucket.tryTake()).toBe(true);
  });

  it("never exceeds capacity however long it idles", () => {
    let clock = 0;
    const bucket = new TokenBucket({ capacity: 5, refillPerSecond: 1, now: () => clock });
    clock += 10_000_000;
    expect(bucket.available).toBe(5);
  });
});

/* ------------------------------------------------------------------ */
/* Telemetry                                                          */
/* ------------------------------------------------------------------ */

describe("summariseAiLog", () => {
  const entry = (over: Partial<AiLogEntry>): AiLogEntry => ({
    at: "2026-07-20T00:00:00.000Z",
    feature: "f",
    model: "gemini-flash-latest",
    tier: "balanced",
    promptChars: 100,
    promptTokens: 50,
    outputTokens: 10,
    costUsd: 0.001,
    latencyMs: 500,
    cached: false,
    attempts: 1,
    ok: true,
    ...over,
  });

  it("aggregates calls, failures, cache hits and cost", () => {
    const summary = summariseAiLog([
      entry({ feature: "copilot" }),
      entry({ feature: "copilot", cached: true, costUsd: 0 }),
      entry({ feature: "scan", ok: false, errorKind: "quota" }),
    ]);
    expect(summary.calls).toBe(3);
    expect(summary.failures).toBe(1);
    expect(summary.cacheHits).toBe(1);
    expect(summary.costUsd).toBeCloseTo(0.002);
    expect(summary.byFeature[0]).toMatchObject({ feature: "copilot", calls: 2 });
  });

  it("returns zeroes for an empty log", () => {
    const summary = summariseAiLog([]);
    expect(summary).toMatchObject({ calls: 0, costUsd: 0, medianLatencyMs: 0 });
  });
});

/* ------------------------------------------------------------------ */
/* Structured generation                                              */
/* ------------------------------------------------------------------ */

function stubProvider(responses: string[]): AiProvider & { calls: GenerateRequest[] } {
  const calls: GenerateRequest[] = [];
  let index = 0;
  return {
    id: "stub",
    calls,
    isConfigured: () => true,
    generate: async (request): Promise<GenerateResult> => {
      calls.push(request);
      const text = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return {
        text,
        functionCalls: [],
        model: "stub-model",
        usage: { promptTokens: 1, outputTokens: 1, totalTokens: 2 },
        cached: false,
        latencyMs: 1,
      };
    },
  };
}

describe("runJson", () => {
  beforeEach(() => __resetRateLimiter());

  const schema = z.object({ answer: z.number() });
  const request: GenerateRequest = {
    feature: "test",
    tier: "fast",
    messages: [userText("q")],
    cacheTtlSeconds: 0,
  };

  it("parses and validates a well-formed response", async () => {
    setAiProvider(stubProvider(['{"answer": 42}']));
    const { value } = await runJson(request, schema);
    expect(value.answer).toBe(42);
  });

  it("recovers from prose around the JSON", async () => {
    setAiProvider(stubProvider(['Sure! ```json\n{"answer": 7}\n```']));
    const { value } = await runJson(request, schema);
    expect(value.answer).toBe(7);
  });

  it("gives the model one corrective retry with the validation error", async () => {
    const provider = stubProvider(['{"answer": "not a number"}', '{"answer": 3}']);
    setAiProvider(provider);
    const { value } = await runJson(request, schema);
    expect(value.answer).toBe(3);
    expect(provider.calls).toHaveLength(2);
    // The retry must actually tell the model what went wrong.
    const retry = provider.calls[1];
    const lastText = JSON.stringify(retry.messages.at(-1));
    expect(lastText).toContain("failed validation");
  });

  it("throws a typed error when the model never produces valid JSON", async () => {
    setAiProvider(stubProvider(["no json here", "still nothing"]));
    await expect(runJson(request, schema)).rejects.toMatchObject({
      name: "AiError",
      kind: "invalid-output",
    });
  });

  it("surfaces a missing key as a typed no-key error", async () => {
    setAiProvider({
      id: "unconfigured",
      isConfigured: () => false,
      generate: async () => {
        throw new Error("should never be called");
      },
    });
    await expect(runJson(request, schema)).rejects.toMatchObject({ kind: "no-key" });
  });
});

/* ------------------------------------------------------------------ */
/* Output schemas                                                     */
/* ------------------------------------------------------------------ */

describe("output schemas", () => {
  it("defaults a categorization entry's confidence rather than failing", () => {
    const parsed = categorizeResultSchema.parse({ results: [{ category: "Food" }] });
    expect(parsed.results[0].confidence).toBe("medium");
  });

  it("rejects a category outside the ledger's vocabulary", () => {
    expect(
      categorizeResultSchema.safeParse({ results: [{ category: "Groceries" }] }).success,
    ).toBe(false);
  });

  it("accepts a document extraction with everything unreadable", () => {
    const parsed = documentExtractionSchema.parse({
      documentKind: "receipt",
      confidence: "low",
      merchant: null,
      totalAmount: null,
    });
    expect(parsed.lineItems).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.direction).toBe("debit");
  });
});

/* ------------------------------------------------------------------ */
/* Prompt registry                                                    */
/* ------------------------------------------------------------------ */

describe("prompt registry", () => {
  it("registers every template with a unique id and a real version", () => {
    const prompts = allPrompts();
    expect(prompts.length).toBeGreaterThan(5);
    const ids = prompts.map((prompt) => prompt.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const prompt of prompts) {
      expect(prompt.version).toBeGreaterThan(0);
      expect(prompt.description.length).toBeGreaterThan(10);
    }
  });

  it("versions the feature id so editing a prompt invalidates its cache", () => {
    expect(featureId({ id: "a.b", version: 3 })).toBe("a.b@3");
  });
});

/* ------------------------------------------------------------------ */
/* Tools                                                              */
/* ------------------------------------------------------------------ */

function emptyLedger(): LedgerData {
  return {
    expenses: [],
    recurring: [],
    groups: [],
    budgets: DEFAULT_BUDGETS,
    settings: DEFAULT_SETTINGS,
    accounts: DEFAULT_ACCOUNTS,
    spaces: [],
    subscriptions: [],
    lendBorrows: [],
    recurringInvestments: [],
    goals: [],
    inbox: DEFAULT_INBOX,
    rules: [],
    snapshots: [],
  };
}

describe("tools", () => {
  const context = { data: emptyLedger(), now: new Date("2026-07-20T00:00:00.000Z") };

  it("exposes every tool with a description and an object schema", () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(10);
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.name).toMatch(/^[a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.parameters.type).toBe("object");
    }
  });

  it("returns an error object rather than throwing on an unknown tool", () => {
    const output = runTool("not_a_tool", {}, context);
    expect(output.error).toContain("Unknown tool");
  });

  it("returns an error object rather than throwing on bad arguments", () => {
    const output = runTool("query_transactions", { preset: "nonsense" }, context);
    expect(output.error).toBeDefined();
    expect(output.hint).toBeDefined();
  });

  it("runs every zero-argument tool against an empty ledger without throwing", () => {
    for (const tool of TOOL_DEFINITIONS) {
      const output = runTool(tool.name, {}, context);
      expect(output, `${tool.name} threw`).toBeTypeOf("object");
    }
  });

  it("answers a real query with computed numbers", () => {
    const withData = {
      ...context,
      data: {
        ...context.data,
        expenses: [
          {
            id: "x",
            description: "Coffee",
            amount: 250,
            category: "Food" as const,
            date: "2026-07-10",
            type: "expense" as const,
            affectsBalance: true,
            tags: [],
            attachments: [],
            createdAt: "2026-07-10T00:00:00.000Z",
          },
        ],
      },
    };
    const output = runTool("query_transactions", { preset: "thisMonth" }, withData);
    expect(output.total).toBe(250);
    expect(output.count).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Errors                                                             */
/* ------------------------------------------------------------------ */

describe("AiError", () => {
  it("carries a machine-readable kind and a retryable flag", () => {
    const error = new AiError("boom", "quota", true);
    expect(error.kind).toBe("quota");
    expect(error.retryable).toBe(true);
    expect(error).toBeInstanceOf(Error);
  });
});
