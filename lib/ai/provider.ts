/**
 * Provider-agnostic AI contract.
 *
 * Everything above this file (features, prompts, the copilot) talks in these
 * types only. Swapping Gemini for another provider — or adding a local model
 * for the privacy-maximalist path in docs/product-analysis/04 — means writing
 * one more object that satisfies `AiProvider`, not touching a feature.
 */

import type { ModelTier } from "./models";

export type JsonSchema = Record<string, unknown>;

export interface InlineData {
  mimeType: string;
  /** base64, no data: prefix. */
  data: string;
}

export type AiPart =
  | { text: string }
  | { inlineData: InlineData }
  | { functionCall: AiFunctionCall }
  | { functionResponse: AiFunctionResponse };

export interface AiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AiFunctionResponse {
  name: string;
  response: Record<string, unknown>;
}

export interface AiMessage {
  role: "user" | "model";
  parts: AiPart[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** OpenAPI-subset schema. Keep it shallow — deep schemas get rejected. */
  parameters: JsonSchema;
}

/** How much latency to trade for reasoning quality. */
export type ThinkingLevel = "off" | "low" | "high";

export interface GenerateRequest {
  /** Stable feature id — the unit of telemetry, caching and rate limiting. */
  feature: string;
  tier: ModelTier;
  messages: AiMessage[];
  system?: string;
  /** Forces structured output validated against this schema. */
  schema?: JsonSchema;
  tools?: ToolDefinition[];
  temperature?: number;
  maxOutputTokens?: number;
  thinking?: ThinkingLevel;
  signal?: AbortSignal;
  /** Skip the response cache for this call (e.g. user pressed "regenerate"). */
  noCache?: boolean;
  /** Seconds a cached response stays fresh. 0 disables caching for the call. */
  cacheTtlSeconds?: number;
}

export interface AiUsage {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GenerateResult {
  text: string;
  functionCalls: AiFunctionCall[];
  model: string;
  usage: AiUsage;
  cached: boolean;
  latencyMs: number;
  /** Set when the model stopped for a reason other than finishing normally. */
  finishReason?: string;
}

export type AiErrorKind =
  | "no-key"
  | "auth"
  | "quota"
  | "rate-limit"
  | "network"
  | "timeout"
  | "cancelled"
  | "safety"
  | "model-missing"
  | "invalid-output"
  | "response";

/** Errors the UI can branch on without string matching. */
export class AiError extends Error {
  constructor(
    message: string,
    public readonly kind: AiErrorKind,
    /** True when trying the exact same call again could plausibly succeed. */
    public readonly retryable = false,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface AiProvider {
  id: string;
  isConfigured(): boolean;
  generate(request: GenerateRequest): Promise<GenerateResult>;
  /**
   * Token-by-token generation. `onChunk` receives deltas, not the whole text.
   * Providers that can't stream may omit this; callers fall back to generate().
   */
  stream?(
    request: GenerateRequest,
    onChunk: (delta: string) => void,
  ): Promise<GenerateResult>;
}

export function textOf(message: AiMessage): string {
  return message.parts
    .map((part) => ("text" in part ? part.text : ""))
    .join("")
    .trim();
}

export function userText(text: string): AiMessage {
  return { role: "user", parts: [{ text }] };
}

export function modelText(text: string): AiMessage {
  return { role: "model", parts: [{ text }] };
}
