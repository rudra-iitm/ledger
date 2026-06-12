"use client";

import { useMemo } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { buildInsights } from "@/lib/domain/insights";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function InsightsStrip() {
  const expenses = useAppStore((state) => state.data.expenses);
  const currency = useAppStore((state) => state.data.settings.currency);
  const insights = useMemo(
    () => buildInsights(expenses, currency),
    [expenses, currency],
  );

  if (insights.length === 0) return null;

  return (
    <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
      {insights.map((insight) => (
        <li
          key={insight.id}
          className="flex min-w-[10rem] shrink-0 snap-start scroll-mx-5 flex-col gap-1 rounded-2xl border border-border bg-card px-4 py-4 shadow-soft"
        >
          <span className="text-[12px] text-muted-foreground">
            {insight.label}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 text-lg font-semibold",
              insight.tone === "positive" && "text-positive",
              insight.tone === "negative" && "text-destructive",
            )}
          >
            {insight.id === "trend" && insight.tone === "negative" && (
              <TrendingUp aria-hidden className="size-4" />
            )}
            {insight.id === "trend" && insight.tone === "positive" && (
              <TrendingDown aria-hidden className="size-4" />
            )}
            {insight.value}
          </span>
          {insight.detail && (
            <span className="truncate text-[12px] text-muted-foreground">
              {insight.detail}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
