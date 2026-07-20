import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geminiProvider, isOverloaded, setAiKey } from "@/lib/ai/gemini";
import { chainFor, clearResolved } from "@/lib/ai/models";
import { userText, type GenerateRequest } from "@/lib/ai/provider";

/**
 * Regression cover for a bug found against a live key: `gemini-flash-latest`
 * was answering 503 "this model is currently experiencing high demand", and
 * the transport threw straight out of the model loop. That killed the whole
 * balanced tier while `gemini-flash-lite-latest` sat unused in the same chain,
 * and the client then re-ran the identical request three times into the same
 * busy model.
 */

const OVERLOADED = {
  ok: false,
  status: 503,
  json: async () => ({
    error: {
      code: 503,
      message: "This model is currently experiencing high demand. Please try again later.",
      status: "UNAVAILABLE",
    },
  }),
} as unknown as Response;

const RETIRED = {
  ok: false,
  status: 404,
  json: async () => ({
    error: { code: 404, message: "This model models/x is no longer available to new users." },
  }),
} as unknown as Response;

function okResponse(text: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
    }),
  } as unknown as Response;
}

/** Model id out of the request URL, so assertions read like the chain does. */
function modelOf(url: string): string {
  return url.split("/models/")[1].split(":")[0];
}

const request: GenerateRequest = {
  feature: "test",
  tier: "balanced",
  messages: [userText("hi")],
};

let calls: string[] = [];

/**
 * The suite runs in node, but the whole AI layer is browser-only by design
 * (the key lives in localStorage and never leaves the device). A tiny stub is
 * cheaper and more honest than switching the whole suite to jsdom.
 */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

beforeEach(() => {
  const storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  clearResolved();
  setAiKey("test-key");
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Answer each model id per `plan`; anything unlisted succeeds. */
function stubFetch(plan: Record<string, Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const model = modelOf(url);
      calls.push(model);
      return plan[model] ?? okResponse("ok");
    }),
  );
}

describe("isOverloaded", () => {
  it("recognises a 503 as a busy model, not a broken request", () => {
    expect(isOverloaded(503, "high demand")).toBe(true);
  });

  it("recognises an overloaded 500 by message", () => {
    expect(isOverloaded(500, "The model is overloaded. Try again later.")).toBe(true);
  });

  it("does not mistake a plain server error or a client error for overload", () => {
    expect(isOverloaded(500, "internal error")).toBe(false);
    expect(isOverloaded(400, "high demand")).toBe(false);
    expect(isOverloaded(404, "no longer available")).toBe(false);
  });
});

describe("model chain walking", () => {
  it("falls through to the next model when the preferred one is overloaded", async () => {
    const [first, second] = chainFor("balanced");
    stubFetch({ [first.id]: OVERLOADED });

    const result = await geminiProvider.generate(request);

    expect(result.model).toBe(second.id);
    expect(calls[0]).toBe(first.id);
    expect(calls).toContain(second.id);
  });

  it("does not re-probe a busy model through the degradation ladder", async () => {
    // Shedding a generationConfig field cannot fix "the server is busy", so
    // burning three more calls on it is pure waste.
    const [first] = chainFor("balanced");
    stubFetch({ [first.id]: OVERLOADED });

    await geminiProvider.generate(request);

    expect(calls.filter((model) => model === first.id)).toHaveLength(1);
  });

  it("stays retryable when every model in the chain is busy", async () => {
    const plan: Record<string, Response> = {};
    for (const spec of chainFor("balanced")) plan[spec.id] = OVERLOADED;
    stubFetch(plan);

    // Retryable matters: the client backs off and tries again later rather
    // than reporting a dead end for what is a passing spike.
    await expect(geminiProvider.generate(request)).rejects.toMatchObject({
      name: "AiError",
      retryable: true,
    });
    expect(calls).toHaveLength(chainFor("balanced").length);
  });

  it("still walks past a retired model", async () => {
    const [first, second] = chainFor("balanced");
    stubFetch({ [first.id]: RETIRED });

    const result = await geminiProvider.generate(request);
    expect(result.model).toBe(second.id);
  });
});

describe("resolved-model memory", () => {
  it("pins the winner when the models it skipped were permanently gone", async () => {
    const [first, second] = chainFor("balanced");
    stubFetch({ [first.id]: RETIRED });

    await geminiProvider.generate(request);

    // Retirement is a durable fact, so the next call should lead with the
    // model that actually answered.
    expect(chainFor("balanced")[0].id).toBe(second.id);
  });

  it("does NOT pin the winner when it only skipped a busy model", async () => {
    const [first] = chainFor("balanced");
    stubFetch({ [first.id]: OVERLOADED });

    await geminiProvider.generate(request);

    // A busy minute must not demote the preferred model of a tier forever.
    expect(chainFor("balanced")[0].id).toBe(first.id);
  });
});

describe("error mapping still distinguishes the fatal cases", () => {
  it("treats a bad key as auth, not as a busy model", async () => {
    stubFetch({
      [chainFor("balanced")[0].id]: {
        ok: false,
        status: 400,
        json: async () => ({ error: { code: 400, message: "API key not valid." } }),
      } as unknown as Response,
    });

    await expect(geminiProvider.generate(request)).rejects.toMatchObject({ kind: "auth" });
    // A bad key is fatal for every model, so we must not walk the chain and
    // multiply one user error into three rejected calls.
    expect(calls).toHaveLength(1);
  });
});
