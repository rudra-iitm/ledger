"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearAiLog,
  readAiLog,
  subscribeAiLog,
  summariseAiLog,
  type AiLogEntry,
} from "@/lib/ai/telemetry";
import { aiCacheSize, clearAiCache } from "@/lib/ai/cache";
import { DAILY_CALL_CAP, dailyCallsRemaining } from "@/lib/ai/rate-limit";

/**
 * The screen the privacy promise rests on.
 *
 * The README tells the user every AI call is listed here, so this renders the
 * whole log — what ran, on which model, how big the prompt was, how long it
 * took and what it cost. Prompt *content* is deliberately absent: storing it
 * would make this a second copy of the ledger, which is the thing the design
 * is trying to avoid.
 */

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCost(usd: number): string {
  if (usd <= 0) return "—";
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function Row({ entry }: { entry: AiLogEntry }) {
  return (
    <li className="flex flex-col gap-0.5 border-t border-border py-2 first:border-t-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px]">{entry.feature}</span>
        <span
          className={
            entry.ok
              ? "shrink-0 text-[11px] text-muted-foreground"
              : "shrink-0 text-[11px] text-destructive"
          }
        >
          {entry.cached ? "cached" : entry.ok ? "ok" : (entry.errorKind ?? "failed")}
        </span>
      </div>
      <p className="text-[11px] tabular-nums text-muted-foreground">
        {formatTime(entry.at)} · {entry.model} · {entry.promptChars.toLocaleString()} chars
        {entry.cached ? null : ` · ${entry.latencyMs} ms · ${formatCost(entry.costUsd)}`}
        {entry.attempts > 1 ? ` · ${entry.attempts} attempts` : ""}
      </p>
    </li>
  );
}

export function AiActivityLog() {
  const [entries, setEntries] = useState<AiLogEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [cached, setCached] = useState(0);
  const [remaining, setRemaining] = useState(DAILY_CALL_CAP);

  const refresh = () => {
    setEntries(readAiLog());
    setCached(aiCacheSize());
    setRemaining(dailyCallsRemaining());
  };

  // localStorage reads are deferred to an effect so the static export never
  // touches storage during render.
  useEffect(() => {
    refresh();
    return subscribeAiLog(refresh);
  }, []);

  const summary = useMemo(() => summariseAiLog(entries), [entries]);

  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground">
        No AI calls yet. Every call will be listed here.
      </p>
    );
  }

  const shown = expanded ? entries : entries.slice(0, 5);

  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-secondary px-2 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Calls
          </dt>
          <dd className="text-[15px] font-medium tabular-nums">{summary.calls}</dd>
        </div>
        <div className="rounded-xl bg-secondary px-2 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Est. cost
          </dt>
          <dd className="text-[15px] font-medium tabular-nums">
            {formatCost(summary.costUsd)}
          </dd>
        </div>
        <div className="rounded-xl bg-secondary px-2 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Median
          </dt>
          <dd className="text-[15px] font-medium tabular-nums">
            {summary.medianLatencyMs} ms
          </dd>
        </div>
      </dl>

      <p className="text-[11px] text-muted-foreground">
        {summary.cacheHits} served from cache ({cached} stored) ·{" "}
        {summary.failures} failed · {remaining} of {DAILY_CALL_CAP} calls left today
      </p>

      <ul className="flex flex-col">
        {shown.map((entry, index) => (
          <Row key={`${entry.at}-${index}`} entry={entry} />
        ))}
      </ul>

      <div className="flex items-center gap-2">
        {entries.length > 5 ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
            {expanded ? "Show less" : `Show all ${entries.length}`}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-muted-foreground"
          onClick={() => {
            clearAiLog();
            clearAiCache();
            refresh();
          }}
        >
          <Trash2 aria-hidden />
          Clear log & cache
        </Button>
      </div>
    </div>
  );
}
