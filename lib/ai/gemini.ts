"use client";

/**
 * Gemini transport (bring-your-own-key).
 *
 * Doctrine (docs/product-analysis/04): deterministic engines compute, AI
 * narrates/extracts on top. The key lives in localStorage ONLY — never in the
 * synced data files, so it can't leak into the GitHub data repo or backups.
 *
 * This file knows about HTTP and Gemini's JSON dialect and nothing else. It
 * does not retry, cache, rate-limit or log — `client.ts` owns those policies
 * so they apply uniformly to every provider we ever add.
 *
 * Two resilience behaviours do live here, because only the transport can see
 * the conditions that trigger them:
 *  - **model fallback**: an id Google has retired walks down the tier chain;
 *  - **body degradation**: a request rejected for an unsupported generation
 *    field is retried without that field, so a model that lacks (say)
 *    `thinkingConfig` still answers instead of 400-ing the feature away.
 */

import { chainFor, rememberResolved } from "./models";
import {
  AiError,
  type AiFunctionCall,
  type AiProvider,
  type GenerateRequest,
  type GenerateResult,
} from "./provider";

const KEY_STORAGE = "ledger:ai-key";
const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 60_000;

export function getAiKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY_STORAGE);
}

export function setAiKey(key: string): void {
  window.localStorage.setItem(KEY_STORAGE, key.trim());
}

export function clearAiKey(): void {
  window.localStorage.removeItem(KEY_STORAGE);
}

export function aiAvailable(): boolean {
  return Boolean(getAiKey());
}

/** Shape of a Gemini `generateContent` response, narrowed to what we read. */
interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string; status?: string };
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
}

/**
 * How much of the request body to give up in exchange for compatibility.
 * Each level drops the field that most commonly trips an unfamiliar model.
 */
type Degrade = 0 | 1 | 2 | 3;

function thinkingBudget(request: GenerateRequest): number | undefined {
  switch (request.thinking) {
    case "off":
      return 0;
    case "low":
      return 512;
    case "high":
      return 8192;
    default:
      return undefined;
  }
}

export function buildBody(
  request: GenerateRequest,
  degrade: Degrade = 0,
): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    temperature: request.temperature ?? 0.2,
  };
  if (request.maxOutputTokens) {
    generationConfig.maxOutputTokens = request.maxOutputTokens;
  }

  const budget = thinkingBudget(request);
  if (budget !== undefined && degrade < 1) {
    generationConfig.thinkingConfig = { thinkingBudget: budget };
  }

  // Gemini rejects a response schema when tools are in play — the model has to
  // stay free to emit a functionCall part instead of the schema's shape.
  const structured = request.schema && !request.tools?.length;
  if (structured && degrade < 3) {
    generationConfig.responseMimeType = "application/json";
    if (degrade < 2) generationConfig.responseSchema = request.schema;
  }

  const body: Record<string, unknown> = {
    contents: request.messages.map((message) => ({
      role: message.role,
      parts: message.parts,
    })),
    generationConfig,
  };

  if (request.system) {
    body.systemInstruction = { parts: [{ text: request.system }] };
  }
  if (request.tools?.length) {
    body.tools = [
      {
        functionDeclarations: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ];
    body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }
  return body;
}

/** True when the failure means "this model id isn't available to this key". */
function isModelMissing(status: number, message: string): boolean {
  if (status === 404) return true;
  return (
    status === 400 &&
    /not found|not supported|unsupported model|is not available/i.test(message)
  );
}

/**
 * True when the failure is about the key rather than the request.
 *
 * Gemini answers a bad key with **400**, not 401/403, so status alone can't
 * tell this apart from a malformed request. Without this check a wrong key
 * surfaces as a generic "response" error and the UI never offers the one
 * thing that would fix it.
 */
export function isKeyProblem(status: number, message: string): boolean {
  return (
    (status === 400 || status === 401 || status === 403) &&
    /api[ _-]?key not valid|invalid api[ _-]?key|api[ _-]?key expired|API_KEY_INVALID|permission denied/i.test(
      message,
    )
  );
}

/** True when the failure looks like an unrecognised generationConfig field. */
function isBadArgument(status: number, message: string): boolean {
  if (isKeyProblem(status, message)) return false;
  return (
    status === 400 &&
    /invalid|unknown name|unsupported|not supported|thinking|schema/i.test(message)
  );
}

function mapHttpError(status: number, message: string): AiError {
  if (isKeyProblem(status, message) || status === 401 || status === 403) {
    return new AiError("Gemini rejected the API key — check it in Settings.", "auth");
  }
  if (status === 429) {
    return new AiError("Gemini rate limit hit — pausing before the next try.", "quota", true);
  }
  if (status >= 500) {
    return new AiError("Gemini is having trouble — retrying.", "response", true);
  }
  return new AiError(message || `Gemini error (${status}).`, "response");
}

function readParts(body: GeminiResponse): {
  text: string;
  functionCalls: AiFunctionCall[];
  finishReason?: string;
} {
  const candidate = body.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  const functionCalls: AiFunctionCall[] = [];
  for (const part of parts) {
    if (part.functionCall?.name) {
      functionCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args ?? {},
      });
    }
  }
  return { text, functionCalls, finishReason: candidate?.finishReason };
}

function usageOf(body: GeminiResponse) {
  const usage = body.usageMetadata ?? {};
  const promptTokens = usage.promptTokenCount ?? 0;
  const outputTokens = usage.candidatesTokenCount ?? 0;
  return {
    promptTokens,
    outputTokens,
    totalTokens: usage.totalTokenCount ?? promptTokens + outputTokens,
  };
}

/** Merge the caller's abort signal with our own timeout. */
function withTimeout(signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Timeout", "TimeoutError")),
    REQUEST_TIMEOUT_MS,
  );
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

async function post(
  model: string,
  body: unknown,
  key: string,
  signal: AbortSignal,
  stream: boolean,
): Promise<Response> {
  const method = stream ? "streamGenerateContent?alt=sse&" : "generateContent?";
  try {
    return await fetch(`${API_ROOT}/${model}:${method}key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    const name = (error as Error)?.name;
    if (name === "TimeoutError") {
      throw new AiError("Gemini took too long to answer.", "timeout", true);
    }
    if (name === "AbortError") {
      throw new AiError("Cancelled.", "cancelled");
    }
    throw new AiError("Couldn't reach Gemini — check your connection.", "network", true, error);
  }
}

async function errorMessageOf(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as GeminiResponse;
    return body.error?.message ?? "";
  } catch {
    return "";
  }
}

/**
 * Walk the tier's model chain and the degradation ladder until one
 * combination is accepted.
 */
async function attempt(
  request: GenerateRequest,
  key: string,
  signal: AbortSignal,
): Promise<{ body: GeminiResponse; model: string }> {
  const chain = chainFor(request.tier);
  let lastError: AiError | null = null;

  for (const spec of chain) {
    for (let degrade = 0; degrade <= 3; degrade += 1) {
      const response = await post(
        spec.id,
        buildBody(request, degrade as Degrade),
        key,
        signal,
        false,
      );
      if (response.ok) {
        rememberResolved(request.tier, spec.id);
        return { body: (await response.json()) as GeminiResponse, model: spec.id };
      }

      const message = await errorMessageOf(response);
      if (isModelMissing(response.status, message)) {
        lastError = new AiError(
          `Model ${spec.id} is unavailable for this key.`,
          "model-missing",
        );
        break; // next model, not next degradation
      }
      if (isBadArgument(response.status, message) && degrade < 3) {
        continue; // shed a generation field and try the same model again
      }
      throw mapHttpError(response.status, message);
    }
  }
  throw lastError ?? new AiError("No Gemini model accepted this request.", "model-missing");
}

function assertKey(): string {
  const key = getAiKey();
  if (!key) throw new AiError("Add your Gemini API key in Settings first.", "no-key");
  return key;
}

function resultFrom(
  body: GeminiResponse,
  model: string,
  startedAt: number,
): GenerateResult {
  const blocked = body.promptFeedback?.blockReason;
  if (blocked) {
    throw new AiError(`Gemini blocked this request (${blocked}).`, "safety");
  }
  const { text, functionCalls, finishReason } = readParts(body);
  if (!text && functionCalls.length === 0) {
    throw new AiError(
      finishReason === "MAX_TOKENS"
        ? "Gemini ran out of output space — try a narrower question."
        : "Gemini returned an empty response.",
      "response",
      true,
    );
  }
  return {
    text,
    functionCalls,
    model,
    usage: usageOf(body),
    cached: false,
    latencyMs: Date.now() - startedAt,
    finishReason,
  };
}

export const geminiProvider: AiProvider = {
  id: "gemini",

  isConfigured: aiAvailable,

  async generate(request) {
    const key = assertKey();
    const startedAt = Date.now();
    const timeout = withTimeout(request.signal);
    try {
      const { body, model } = await attempt(request, key, timeout.signal);
      return resultFrom(body, model, startedAt);
    } finally {
      timeout.done();
    }
  },

  async stream(request, onChunk) {
    const key = assertKey();
    const startedAt = Date.now();
    const timeout = withTimeout(request.signal);
    try {
      // Streaming skips the degradation ladder: a stream that fails mid-flight
      // can't be silently retried without replaying text the user already saw,
      // so the caller falls back to the non-streaming path instead.
      const model = chainFor(request.tier)[0].id;
      const response = await post(model, buildBody(request), key, timeout.signal, true);
      if (!response.ok || !response.body) {
        const message = await errorMessageOf(response);
        if (isModelMissing(response.status, message) || isBadArgument(response.status, message)) {
          throw new AiError("Streaming unavailable for this model.", "model-missing");
        }
        throw mapHttpError(response.status, message);
      }
      return await consumeStream(response.body, model, startedAt, onChunk);
    } finally {
      timeout.done();
    }
  },
};

/** Parse `alt=sse` frames, emitting text deltas as they arrive. */
async function consumeStream(
  stream: ReadableStream<Uint8Array>,
  model: string,
  startedAt: number,
  onChunk: (delta: string) => void,
): Promise<GenerateResult> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const functionCalls: AiFunctionCall[] = [];
  let usage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };
  let finishReason: string | undefined;

  const handleFrame = (payload: string) => {
    if (!payload || payload === "[DONE]") return;
    let body: GeminiResponse;
    try {
      body = JSON.parse(payload) as GeminiResponse;
    } catch {
      return; // a partial frame; the next read completes it
    }
    const parsed = readParts(body);
    if (parsed.text) {
      text += parsed.text;
      onChunk(parsed.text);
    }
    functionCalls.push(...parsed.functionCalls);
    if (parsed.finishReason) finishReason = parsed.finishReason;
    if (body.usageMetadata) usage = usageOf(body);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line.startsWith("data:")) handleFrame(line.slice(5).trim());
      newline = buffer.indexOf("\n");
    }
  }
  const tail = buffer.trim();
  if (tail.startsWith("data:")) handleFrame(tail.slice(5).trim());

  if (!text && functionCalls.length === 0) {
    throw new AiError("Gemini returned an empty response.", "response", true);
  }
  return {
    text,
    functionCalls,
    model,
    usage,
    cached: false,
    latencyMs: Date.now() - startedAt,
    finishReason,
  };
}

export { AiError };
