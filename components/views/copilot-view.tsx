"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Bot, ListFilter, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { aiAvailable } from "@/lib/ai/gemini";
import { AiError } from "@/lib/ai/provider";
import {
  askCopilot,
  COPILOT_SUGGESTIONS,
  type CopilotMessage,
  type Evidence,
} from "@/lib/ai/features/copilot";
import type { LedgerQuery } from "@/lib/domain/query";
import { useAppStore } from "@/lib/store/app-store";

/** Turn a query into the expenses-screen deep link that reproduces it. */
function expensesHref(query: LedgerQuery): string {
  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.preset && query.preset !== "custom") params.set("preset", query.preset);
  if (query.text) params.set("q", query.text);
  const search = params.toString();
  return search ? `/expenses?${search}` : "/expenses";
}

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return null;
  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Checked
      </p>
      <ul className="flex flex-col gap-1">
        {evidence.map((item, index) => (
          <li key={`${item.tool}-${index}`} className="text-[12px] text-muted-foreground">
            {item.query ? (
              <Link
                href={expensesHref(item.query)}
                className="inline-flex items-center gap-1.5 rounded-md underline decoration-dotted underline-offset-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ListFilter aria-hidden className="size-3" />
                {item.label}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <ListFilter aria-hidden className="size-3 opacity-50" />
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CopilotView() {
  const data = useAppStore((state) => state.data);
  const [aiOn, setAiOn] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setAiOn(aiAvailable());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming, step]);

  // Cancel any in-flight answer if the screen goes away mid-stream.
  useEffect(() => () => abortRef.current?.abort(), []);

  const hasLedger = useMemo(
    () => data.expenses.length > 0 || data.accounts.length > 0,
    [data.expenses.length, data.accounts.length],
  );

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    const history = messages;
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setInput("");
    setBusy(true);
    setStreaming("");
    setStep(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const answer = await askCopilot({
        question: trimmed,
        history,
        context: { data, now: new Date() },
        signal: controller.signal,
        onDelta: (delta) => setStreaming((current) => current + delta),
        onStep: (label) => setStep(label),
      });
      setMessages((current) => [
        ...current,
        { role: "assistant", text: answer.text, evidence: answer.evidence },
      ]);
    } catch (error) {
      const aiError = error instanceof AiError ? error : null;
      if (aiError?.kind !== "cancelled") {
        toast.error(aiError?.message ?? "The copilot couldn't answer that.");
      }
      // Drop the unanswered question so the transcript never implies a reply.
      setMessages((current) => current.slice(0, -1));
      setInput(trimmed);
    } finally {
      setBusy(false);
      setStreaming("");
      setStep(null);
      abortRef.current = null;
    }
  };

  if (!aiOn) {
    return (
      <EmptyState
        icon={Bot}
        title="Copilot needs a Gemini key"
        description="Add your own Gemini API key in Settings. It stays in this browser — never in your synced data or backups."
        action={
          <Button variant="secondary" asChild>
            <Link href="/settings">Open Settings</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Conversation" className="flex flex-col gap-3">
        {messages.length === 0 && !busy ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-soft">
            <div className="flex items-start gap-3">
              <Bot aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Ask anything about your money. Every answer is computed from your
                own ledger — the numbers come from the app, not the model, and
                each one links back to the transactions behind it.
              </p>
            </div>
            {hasLedger ? (
              <ul className="-mx-1 flex flex-col">
                {COPILOT_SUGGESTIONS.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => void ask(suggestion)}
                      className="w-full rounded-xl px-3 py-2.5 text-left text-[14px] outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Add a few transactions first — there is nothing to reason about yet.
              </p>
            )}
          </div>
        ) : null}

        {messages.map((message, index) =>
          message.role === "user" ? (
            <div key={index} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl bg-secondary px-4 py-2.5 text-[15px]">
                {message.text}
              </p>
            </div>
          ) : (
            <div
              key={index}
              className="rounded-2xl border border-border bg-card px-4 py-4 shadow-soft"
            >
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                {message.text}
              </p>
              <EvidenceList evidence={message.evidence ?? []} />
            </div>
          ),
        )}

        {busy ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-soft">
            {streaming ? (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                {streaming}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Bot aria-hidden className="size-4 animate-pulse" />
                {step ?? "Thinking…"}
              </p>
            )}
          </div>
        ) : null}
        <div ref={bottomRef} />
      </section>

      <form
        className="sticky bottom-24 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(input);
        }}
      >
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about your money…"
          aria-label="Ask the copilot"
          autoComplete="off"
          disabled={busy}
        />
        {busy ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Stop"
            onClick={() => abortRef.current?.abort()}
          >
            <Square aria-hidden />
          </Button>
        ) : (
          <Button type="submit" size="icon" aria-label="Send" disabled={!input.trim()}>
            <ArrowUp aria-hidden />
          </Button>
        )}
      </form>

      {messages.length > 0 && !busy ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-center text-muted-foreground"
          onClick={() => setMessages([])}
        >
          <Trash2 aria-hidden />
          Clear conversation
        </Button>
      ) : null}
    </div>
  );
}
