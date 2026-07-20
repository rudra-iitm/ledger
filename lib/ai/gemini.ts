"use client";

/**
 * Gemini client (bring-your-own-key).
 *
 * Doctrine (docs/product-analysis/04): deterministic engines compute, AI
 * narrates/extracts on top. The key lives in localStorage ONLY — never in
 * the synced data files, so it can't leak into the GitHub data repo or
 * backups. Every call is recorded in a local activity log the user can
 * inspect in Settings.
 */

const KEY_STORAGE = "ledger:ai-key";
const LOG_STORAGE = "ledger:ai-log";
// The -latest alias tracks Google's current flash model, so the app keeps
// working when individual model versions are retired for new accounts.
const DEFAULT_MODEL = "gemini-flash-latest";
const LOG_LIMIT = 20;

export interface AiLogEntry {
  at: string;
  feature: string;
  model: string;
  promptChars: number;
  ok: boolean;
}

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

export function readAiLog(): AiLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOG_STORAGE);
    return raw ? (JSON.parse(raw) as AiLogEntry[]) : [];
  } catch {
    return [];
  }
}

function logCall(entry: AiLogEntry): void {
  try {
    const log = [entry, ...readAiLog()].slice(0, LOG_LIMIT);
    window.localStorage.setItem(LOG_STORAGE, JSON.stringify(log));
  } catch {
    /* logging must never break the feature */
  }
}

export class AiError extends Error {
  constructor(
    message: string,
    public readonly kind: "no-key" | "auth" | "quota" | "network" | "response",
  ) {
    super(message);
    this.name = "AiError";
  }
}

interface GenerateOptions {
  feature: string;
  json?: boolean;
  /**
   * OpenAPI-style response schema for Gemini's constrained decoding —
   * guarantees complete, valid JSON (Gemini 3 without it occasionally
   * drops the closing brace on JSON responses).
   */
  schema?: object;
  model?: string;
}

/** One-shot text generation. Returns the model's text response. */
export async function generate(
  prompt: string,
  options: GenerateOptions,
): Promise<string> {
  const key = getAiKey();
  if (!key) throw new AiError("Add your Gemini API key in Settings first.", "no-key");
  const model = options.model ?? DEFAULT_MODEL;

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            ...(options.json || options.schema
              ? { responseMimeType: "application/json" }
              : {}),
            ...(options.schema ? { responseSchema: options.schema } : {}),
          },
        }),
      },
    );
  } catch {
    logCall({ at: new Date().toISOString(), feature: options.feature, model, promptChars: prompt.length, ok: false });
    throw new AiError("Couldn't reach Gemini — check your connection.", "network");
  }

  const ok = response.ok;
  logCall({
    at: new Date().toISOString(),
    feature: options.feature,
    model,
    promptChars: prompt.length,
    ok,
  });

  if (!ok) {
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new AiError(
        "Gemini rejected the API key — check it in Settings.",
        "auth",
      );
    }
    if (response.status === 429) {
      throw new AiError("Gemini rate limit hit — try again in a minute.", "quota");
    }
    throw new AiError(`Gemini error (${response.status}).`, "response");
  }

  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new AiError("Gemini returned an empty response.", "response");
  return text;
}
