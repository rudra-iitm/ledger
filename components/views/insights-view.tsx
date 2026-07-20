"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CircleDot,
  Copy,
  Lightbulb,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { aiAvailable } from "@/lib/ai/gemini";
import { AiError } from "@/lib/ai/provider";
import { adviseOnHealth, findInsights } from "@/lib/ai/features/advisor";
import type { HealthAdvice, InsightFindings } from "@/lib/ai/schemas";
import { formatMoney } from "@/lib/domain/money";
import type { HealthReport } from "@/lib/domain/health";
import { useAppStore } from "@/lib/store/app-store";

const KIND_ICONS = {
  waste: Copy,
  drift: TrendingUp,
  duplicate: Copy,
  spike: AlertTriangle,
  opportunity: Lightbulb,
  pattern: CircleDot,
} as const;

const CONFIDENCE_LABEL = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
} as const;

function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function InsightsView() {
  const data = useAppStore((state) => state.data);
  const currency = data.settings.currency;

  const [aiOn, setAiOn] = useState(false);
  const [findings, setFindings] = useState<InsightFindings | null>(null);
  const [health, setHealth] = useState<{ report: HealthReport; advice: HealthAdvice } | null>(null);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    setAiOn(aiAvailable());
  }, []);

  const hasHistory = data.expenses.length >= 5;

  const loadFindings = async () => {
    setLoadingFindings(true);
    try {
      setFindings(await findInsights({ data, now: new Date() }));
    } catch (error) {
      toast.error(
        error instanceof AiError ? error.message : "Couldn't generate insights.",
      );
    } finally {
      setLoadingFindings(false);
    }
  };

  const loadHealth = async () => {
    setLoadingHealth(true);
    try {
      setHealth(await adviseOnHealth({ data, now: new Date() }));
    } catch (error) {
      toast.error(
        error instanceof AiError ? error.message : "Couldn't build a health plan.",
      );
    } finally {
      setLoadingHealth(false);
    }
  };

  if (!aiOn) {
    return (
      <EmptyState
        icon={Bot}
        title="Insights need a Gemini key"
        description="Add your own Gemini API key in Settings. It stays in this browser — never in your synced data or backups."
        action={
          <Button variant="secondary" asChild>
            <Link href="/settings">Open Settings</Link>
          </Button>
        }
      />
    );
  }

  if (!hasHistory) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="Not enough history yet"
        description="Add or import a few weeks of transactions and Ledger can start finding patterns worth acting on."
        action={
          <Button variant="secondary" asChild>
            <Link href="/import">Import a statement</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Spending insights" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-medium text-muted-foreground">
            What’s worth your attention
          </h2>
          {findings ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={loadingFindings}
              onClick={() => void loadFindings()}
            >
              <RefreshCw aria-hidden />
              {loadingFindings ? "Rescanning…" : "Rescan"}
            </Button>
          ) : null}
        </div>

        {loadingFindings && !findings ? <SectionSkeleton /> : null}

        {!findings && !loadingFindings ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-soft">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Scans this month’s categories, merchants and subscriptions for
              creeping increases, overlapping services and charges that add up.
              Only aggregates are sent — never your transaction list.
            </p>
            <Button variant="secondary" onClick={() => void loadFindings()}>
              <Bot aria-hidden />
              Find what I’m missing
            </Button>
          </div>
        ) : null}

        {findings && findings.findings.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card px-4 py-4 text-[14px] text-muted-foreground shadow-soft">
            Nothing stood out this month — your spending looks consistent with
            recent months.
          </p>
        ) : null}

        {findings?.findings.map((finding, index) => {
          const Icon = KIND_ICONS[finding.kind] ?? Lightbulb;
          return (
            <article
              key={`${finding.title}-${index}`}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-4 shadow-soft"
            >
              <div className="flex items-start gap-3">
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[15px] font-medium">{finding.title}</h3>
                    {typeof finding.estimatedMonthlySaving === "number" &&
                    finding.estimatedMonthlySaving > 0 ? (
                      <Badge variant="positive" className="shrink-0 tabular-nums">
                        {formatMoney(finding.estimatedMonthlySaving, currency)}/mo
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-[14px] leading-relaxed text-muted-foreground">
                    {finding.detail}
                  </p>
                </div>
              </div>
              <p className="border-t border-border pt-2 text-[12px] text-muted-foreground">
                <span className="text-foreground/70">Based on:</span> {finding.evidence}
                {" · "}
                {CONFIDENCE_LABEL[finding.confidence]}
              </p>
            </article>
          );
        })}
      </section>

      <section aria-label="Health plan" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-medium text-muted-foreground">
            What to fix next
          </h2>
          {health ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={loadingHealth}
              onClick={() => void loadHealth()}
            >
              <RefreshCw aria-hidden />
              {loadingHealth ? "Rethinking…" : "Redo"}
            </Button>
          ) : null}
        </div>

        {loadingHealth && !health ? <SectionSkeleton /> : null}

        {!health && !loadingHealth ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-soft">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Ranks the six health-score components by how much fixing each one
              would move your score, with the reasoning shown.
            </p>
            <Button variant="secondary" onClick={() => void loadHealth()}>
              <Bot aria-hidden />
              Build my plan
            </Button>
          </div>
        ) : null}

        {health ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-4 shadow-soft">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] leading-relaxed">{health.advice.headline}</p>
                <span className="shrink-0 text-2xl font-semibold tabular-nums">
                  {health.report.score}
                </span>
              </div>
              {health.report.thin ? (
                <p className="text-[12px] text-muted-foreground">
                  Provisional — there isn’t much history to score yet.
                </p>
              ) : null}
              <Link
                href="/health"
                className="text-[12px] text-muted-foreground underline decoration-dotted underline-offset-2"
              >
                See the six components and their formulas
              </Link>
            </div>

            {health.advice.actions.map((action, index) => (
              <article
                key={`${action.title}-${index}`}
                className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card px-4 py-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-medium">{action.title}</h3>
                  <Badge
                    variant={action.impact === "high" ? "default" : "outline"}
                    className="shrink-0"
                  >
                    {action.impact} impact
                  </Badge>
                </div>
                <p className="text-[14px] leading-relaxed text-muted-foreground">
                  {action.reasoning}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Improves: {action.component}
                </p>
              </article>
            ))}

            {health.advice.strengths.length ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-soft">
                <h3 className="mb-1.5 text-[13px] font-medium text-muted-foreground">
                  Keep doing
                </h3>
                <ul className="flex flex-col gap-1">
                  {health.advice.strengths.map((strength) => (
                    <li key={strength} className="text-[14px] text-muted-foreground">
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Generated by Gemini from aggregates of your ledger. Figures come from
        Ledger’s own calculations — the model interprets them, it doesn’t compute
        them. Always sanity-check before acting.
      </p>
    </div>
  );
}
