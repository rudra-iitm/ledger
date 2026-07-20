"use client";

/**
 * The AI orchestrator — the only door features go through.
 *
 * Everything that must hold for *every* call lives here rather than in any
 * one feature: spend guards, the response cache, retry-with-backoff, schema
 * validation, and the activity log that makes the privacy promise auditable.
 * A feature that reaches past this module into a provider is a bug.
 *
 * Ordering is deliberate — cache before rate-limit before network — so a
 * cached answer costs neither a token in the bucket nor a millisecond of
 * latency.
 */

import { getCached, hashKey, setCached, TTL } from "./cache";
import { geminiProvider } from "./gemini";
import type { ModelTier } from "./models";
import { extractJson } from "./parse";
import {
  AiError,
  type AiProvider,
  type GenerateRequest,
  type GenerateResult,
  userText,
} from "./provider";
import { dailyCallsRemaining, noteDailyCall, withRateLimit } from "./rate-limit";
import { recordAiCall } from "./telemetry";

/** Swappable at runtime so tests — and a future local model — can stand in. */
let provider: AiProvider = geminiProvider;

export function setAiProvider(next: AiProvider): void {
  provider = next;
}

export function activeProvider(): AiProvider {
  return provider;
}

export function aiReady(): boolean {
  return provider.isConfigured();
}

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 700;

function backoffMs(attempt: number): number {
  // Exponential with jitter: without the jitter, several features retrying
  // after one rate-limit event would resynchronise and trip it again.
  const exponential = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  return exponential + Math.random() * 300;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new AiError("Cancelled.", "cancelled"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function promptSize(request: GenerateRequest): number {
  let chars = request.system?.length ?? 0;
  for (const message of request.messages) {
    for (const part of message.parts) {
      if ("text" in part) chars += part.text.length;
      // Inline media is measured, not read: the log records that a document
      // of N bytes was sent without keeping a second copy of it.
      else if ("inlineData" in part) chars += part.inlineData.data.length;
      else chars += JSON.stringify(part).length;
    }
  }
  return chars;
}

/**
 * Cache identity. Deliberately excludes `signal` and `noCache` (not inputs to
 * the answer) and includes everything that is.
 */
function cacheKeyFor(request: GenerateRequest): string {
  return hashKey(
    JSON.stringify({
      feature: request.feature,
      tier: request.tier,
      system: request.system ?? null,
      messages: request.messages,
      schema: request.schema ?? null,
      tools: request.tools?.map((tool) => tool.name) ?? null,
      temperature: request.temperature ?? null,
      thinking: request.thinking ?? null,
    }),
  );
}

function asAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if ((error as Error)?.name === "AbortError") {
    return new AiError("Cancelled.", "cancelled");
  }
  return new AiError(
    (error as Error)?.message || "Something went wrong talking to the model.",
    "response",
    false,
    error,
  );
}

/**
 * Run one request through the full pipeline.
 *
 * Throws `AiError` — never a raw fetch/DOM error — so UI can branch on
 * `error.kind` instead of matching strings.
 */
export async function runAi(request: GenerateRequest): Promise<GenerateResult> {
  if (!provider.isConfigured()) {
    throw new AiError("Add your Gemini API key in Settings first.", "no-key");
  }

  const ttl = request.cacheTtlSeconds ?? TTL.short;
  const cacheable = ttl > 0 && !request.noCache && !request.tools?.length;
  const key = cacheable ? cacheKeyFor(request) : "";

  if (cacheable) {
    const hit = getCached<GenerateResult>(key);
    if (hit) {
      recordAiCall({
        feature: request.feature,
        model: hit.model,
        tier: request.tier,
        promptChars: promptSize(request),
        latencyMs: 0,
        cached: true,
        ok: true,
      });
      return { ...hit, cached: true, latencyMs: 0 };
    }
  }

  if (dailyCallsRemaining() <= 0) {
    throw new AiError(
      "Daily AI limit reached on this device — it resets at midnight.",
      "rate-limit",
    );
  }

  const startedAt = Date.now();
  let lastError: AiError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await withRateLimit(() => {
        noteDailyCall();
        return provider.generate(request);
      }, request.signal);

      recordAiCall({
        feature: request.feature,
        model: result.model,
        tier: request.tier,
        promptChars: promptSize(request),
        promptTokens: result.usage.promptTokens,
        outputTokens: result.usage.outputTokens,
        latencyMs: result.latencyMs,
        attempts: attempt,
        ok: true,
      });
      if (cacheable) setCached(key, result, ttl);
      return result;
    } catch (error) {
      lastError = asAiError(error);
      const fatal = !lastError.retryable || attempt === MAX_ATTEMPTS;
      if (fatal) {
        recordAiCall({
          feature: request.feature,
          model: "—",
          tier: request.tier,
          promptChars: promptSize(request),
          latencyMs: Date.now() - startedAt,
          attempts: attempt,
          ok: false,
          errorKind: lastError.kind,
        });
        throw lastError;
      }
      await delay(backoffMs(attempt), request.signal);
    }
  }
  throw lastError ?? new AiError("Model call failed.", "response");
}

/** A validator that turns raw parsed JSON into `T`, or throws. */
export interface Validator<T> {
  parse: (input: unknown) => T;
}

/**
 * Structured generation: run, parse, validate.
 *
 * On a shape violation the model gets exactly one corrective retry that
 * includes the validation error — far cheaper and more reliable than raising
 * the temperature or hand-patching the output.
 */
export async function runJson<T>(
  request: GenerateRequest,
  validator: Validator<T>,
): Promise<{ value: T; result: GenerateResult }> {
  let attemptRequest = request;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await runAi(attemptRequest);
    const parsed = extractJson<unknown>(result.text);

    if (parsed !== null) {
      try {
        return { value: validator.parse(parsed), result };
      } catch (error) {
        if (attempt === 2) {
          throw new AiError(
            "The model's answer didn't match the expected shape.",
            "invalid-output",
            false,
            error,
          );
        }
        attemptRequest = {
          ...request,
          noCache: true,
          messages: [
            ...request.messages,
            { role: "model", parts: [{ text: result.text.slice(0, 2000) }] },
            userText(
              `That response failed validation: ${(error as Error).message}. ` +
                "Reply again with ONLY valid JSON matching the schema exactly.",
            ),
          ],
        };
        continue;
      }
    }

    if (attempt === 2) {
      throw new AiError("The model didn't return usable JSON.", "invalid-output");
    }
    attemptRequest = { ...request, noCache: true };
  }
  throw new AiError("The model didn't return usable JSON.", "invalid-output");
}

/**
 * Streaming generation, with a non-streaming fallback.
 *
 * Callers get the same `GenerateResult` either way; `onChunk` simply fires
 * once at the end when the provider (or the model) can't stream.
 */
export async function streamAi(
  request: GenerateRequest,
  onChunk: (delta: string) => void,
): Promise<GenerateResult> {
  if (!provider.isConfigured()) {
    throw new AiError("Add your Gemini API key in Settings first.", "no-key");
  }
  if (!provider.stream) {
    const result = await runAi(request);
    onChunk(result.text);
    return result;
  }

  if (dailyCallsRemaining() <= 0) {
    throw new AiError(
      "Daily AI limit reached on this device — it resets at midnight.",
      "rate-limit",
    );
  }

  const startedAt = Date.now();
  try {
    const result = await withRateLimit(() => {
      noteDailyCall();
      return provider.stream!(request, onChunk);
    }, request.signal);
    recordAiCall({
      feature: request.feature,
      model: result.model,
      tier: request.tier,
      promptChars: promptSize(request),
      promptTokens: result.usage.promptTokens,
      outputTokens: result.usage.outputTokens,
      latencyMs: result.latencyMs,
      ok: true,
    });
    return result;
  } catch (error) {
    const aiError = asAiError(error);
    // A model that can't stream is a capability gap, not a failure — fall
    // back rather than surfacing an error the user can do nothing about.
    if (aiError.kind === "model-missing") {
      const result = await runAi(request);
      onChunk(result.text);
      return result;
    }
    recordAiCall({
      feature: request.feature,
      model: "—",
      tier: request.tier,
      promptChars: promptSize(request),
      latencyMs: Date.now() - startedAt,
      ok: false,
      errorKind: aiError.kind,
    });
    throw aiError;
  }
}

/**
 * Single-prompt convenience wrapper.
 *
 * Keeps the shape the first-generation call sites were written against while
 * routing them through the full pipeline.
 */
export async function generate(
  prompt: string,
  options: {
    feature: string;
    json?: boolean;
    schema?: Record<string, unknown>;
    tier?: ModelTier;
    thinking?: GenerateRequest["thinking"];
    cacheTtlSeconds?: number;
    signal?: AbortSignal;
  },
): Promise<string> {
  const result = await runAi({
    feature: options.feature,
    tier: options.tier ?? "balanced",
    messages: [userText(prompt)],
    schema: options.schema,
    thinking: options.thinking,
    cacheTtlSeconds: options.cacheTtlSeconds,
    signal: options.signal,
  });
  return result.text;
}

export { AiError };
