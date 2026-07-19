"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, HeartPulse } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { healthReport } from "@/lib/domain/health";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

function tone(score: number): string {
  if (score >= 70) return "text-positive";
  if (score >= 40) return "text-amber-400";
  return "text-destructive";
}

function barTone(score: number): string {
  if (score >= 70) return "bg-positive";
  if (score >= 40) return "bg-amber-400";
  return "bg-destructive";
}

export function HealthView() {
  const expenses = useAppStore((state) => state.data.expenses);
  const accounts = useAppStore((state) => state.data.accounts);
  const budgets = useAppStore((state) => state.data.budgets);

  const report = useMemo(
    () => healthReport({ expenses, accounts, budgets }),
    [expenses, accounts, budgets],
  );

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Overall score"
        className="flex flex-col items-center gap-2 rounded-3xl border border-border bg-card px-6 py-8 text-center shadow-soft"
      >
        <HeartPulse aria-hidden className="size-6 text-muted-foreground" />
        <p
          className={cn(
            "text-[3.5rem] font-semibold leading-none tabular-nums",
            tone(report.score),
          )}
        >
          {report.score}
        </p>
        <p className="text-[13px] text-muted-foreground">out of 100</p>
        {report.thin && (
          <p className="max-w-xs text-[12px] leading-relaxed text-muted-foreground">
            This score gets meaningful after a couple of months of tracked
            income and spending — import statements to build history faster.
          </p>
        )}
      </section>

      <section aria-label="Components" className="flex flex-col gap-3">
        {report.components.map((component) => (
          <div
            key={component.key}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-medium">{component.label}</span>
              <span className="text-[13px] tabular-nums text-muted-foreground">
                {component.value} ·{" "}
                <span className={tone(component.score)}>{component.score}</span>
              </span>
            </div>
            <Progress
              value={component.score}
              aria-label={`${component.label} score`}
              indicatorClassName={barTone(component.score)}
            />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {component.detail}
            </p>
          </div>
        ))}
      </section>

      <p className="px-1 text-[12px] leading-relaxed text-muted-foreground">
        Every component is a formula over your own data — nothing is a black
        box. Weights: savings 25 · emergency fund 25 · debt 20 ·
        diversification 10 · budget 10 · cushion 10.
      </p>

      <Link
        href="/calendar"
        className="inline-flex items-center gap-1 px-1 text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        See the 90-day cash-flow forecast
        <ChevronRight aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}
