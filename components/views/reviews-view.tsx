"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { aiAvailable } from "@/lib/ai/gemini";
import { AiError, generate } from "@/lib/ai/client";
import { buildReviewPrompt } from "@/lib/ai/prompts";
import { resolveInstitution } from "@/lib/institutions/registry";
import { InstitutionIcon } from "@/components/institution-icon";
import { buildMonthlyReview } from "@/lib/domain/review";
import { currentMonth, nextMonth, previousMonth } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card shadow-soft px-4 py-3.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={cn("text-lg font-semibold tabular-nums", tone)}>{value}</span>
    </div>
  );
}

export function ReviewsView() {
  const data = useAppStore((state) => state.data);
  const currency = data.settings.currency;
  const [month, setMonth] = useState(currentMonth());

  const review = useMemo(
    () =>
      buildMonthlyReview(
        {
          expenses: data.expenses,
          spaces: data.spaces,
          accounts: data.accounts,
          subscriptions: data.subscriptions,
          monthlyBudget: data.budgets.monthlyBudget,
          currency,
        },
        month,
      ),
    [data, currency, month],
  );

  const isCurrent = month >= currentMonth();

  const [aiOn, setAiOn] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    setAiOn(aiAvailable());
  }, []);

  // A new month invalidates the previous month's summary.
  useEffect(() => {
    setSummary(null);
  }, [month]);

  const explainMonth = async () => {
    setSummarizing(true);
    try {
      const text = await generate(buildReviewPrompt(review, currency), {
        feature: "review-summary",
      });
      setSummary(text);
    } catch (error) {
      toast.error(
        error instanceof AiError ? error.message : "Couldn't generate a summary.",
      );
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth(previousMonth(month))}
          className="flex size-9 items-center justify-center rounded-full border border-border outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <span className="text-[15px] font-medium">{review.label}</span>
        <button
          type="button"
          aria-label="Next month"
          disabled={isCurrent}
          onClick={() => setMonth(nextMonth(month))}
          className="flex size-9 items-center justify-center rounded-full border border-border outline-none transition-opacity hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>

      {!review.hasData ? (
        <EmptyState
          icon={CalendarCheck}
          title="No data this month"
          description="Once you record expenses this month, your review appears here."
        />
      ) : (
        <>
          {aiOn && (
            <section aria-label="AI summary" className="flex flex-col gap-2">
              {summary ? (
                <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft">
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Bot aria-hidden className="size-3.5" />
                    AI summary · Gemini
                  </div>
                  <p className="text-[14px] leading-relaxed">{summary}</p>
                  <button
                    type="button"
                    onClick={() => void explainMonth()}
                    disabled={summarizing}
                    className="self-start text-[12px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    {summarizing ? "Regenerating…" : "Regenerate"}
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={summarizing}
                  onClick={() => void explainMonth()}
                >
                  <Bot aria-hidden />
                  {summarizing ? "Thinking…" : "Explain this month"}
                </Button>
              )}
            </section>
          )}
          <section aria-label="Overview" className="grid grid-cols-2 gap-3">
            <Stat label="Total spent" value={formatMoney(review.overview.spent, currency)} />
            <Stat
              label="Budget"
              value={
                review.overview.budget > 0
                  ? formatMoney(review.overview.budget, currency)
                  : "—"
              }
            />
            <Stat
              label="Remaining"
              value={
                review.overview.budget > 0
                  ? formatMoney(review.overview.remaining, currency)
                  : "—"
              }
              tone={review.overview.remaining < 0 ? "text-destructive" : undefined}
            />
            <Stat label="Savings rate" value={`${review.overview.savingsRate}%`} />
          </section>

          <section aria-label="Highlights">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Highlights
            </h2>
            <ul className="flex flex-col gap-1">
              {review.highlights.map((highlight) => (
                <li
                  key={highlight.label}
                  className="flex items-center justify-between px-1 py-2 text-[15px]"
                >
                  <span className="text-muted-foreground">{highlight.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-semibold">{highlight.value}</span>
                    {highlight.detail && (
                      <span className="max-w-36 truncate text-[12px] text-muted-foreground">
                        {highlight.detail}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {review.categoryChanges.length > 0 && (
            <section aria-label="Category changes">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                vs previous month
              </h2>
              <ul className="flex flex-col gap-1">
                {review.categoryChanges.slice(0, 6).map((change) => {
                  const up = change.changePct > 0;
                  return (
                    <li
                      key={change.category}
                      className="flex items-center justify-between px-1 py-2 text-[15px]"
                    >
                      <span>{change.category}</span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums">
                          {formatMoney(change.current, currency)}
                        </span>
                        <span
                          className={cn(
                            "flex w-16 items-center justify-end gap-1 text-[13px] tabular-nums",
                            up ? "text-destructive" : "text-positive",
                          )}
                        >
                          {up ? (
                            <TrendingUp aria-hidden className="size-3.5" />
                          ) : (
                            <TrendingDown aria-hidden className="size-3.5" />
                          )}
                          {up ? "+" : ""}
                          {change.changePct}%
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {review.topSpaces.length > 0 && (
            <section aria-label="Top spaces">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                Top spaces
              </h2>
              <ul className="flex flex-col gap-1.5">
                {review.topSpaces.map(({ space, spent }) => (
                  <li key={space.id}>
                    <Link
                      href={`/space/?id=${space.id}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span aria-hidden className="text-xl">
                        {space.icon}
                      </span>
                      <span className="flex-1 text-[15px] font-medium">
                        {space.name}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(spent, currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Subscriptions">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Subscriptions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Monthly total"
                value={formatMoney(review.subscriptionInsights.monthlyTotal, currency)}
              />
              <Stat
                label="Annual projection"
                value={formatMoney(
                  review.subscriptionInsights.annualProjection,
                  currency,
                )}
              />
            </div>
          </section>

          {review.accountInsights.balances.length > 0 && (
            <section aria-label="Accounts">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                Accounts
              </h2>
              {review.accountInsights.mostUsed && (() => {
                const mostUsed = review.accountInsights.mostUsed;
                const institution = resolveInstitution(mostUsed.name);
                const isGold = mostUsed.assetType === "gold";
                const isSilver = mostUsed.assetType === "silver";
                const displayName = mostUsed.type === "investment" ? mostUsed.name : (institution ? institution.name : mostUsed.name);
                return (
                  <div className="mb-2 px-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    Most used: 
                    <InstitutionIcon 
                      institution={isGold || isSilver ? null : institution} 
                      type={mostUsed.type} 
                      assetType={mostUsed.assetType}
                      size="xs" 
                    />
                    {displayName}
                  </div>
                );
              })()}
              <ul className="flex flex-col gap-1">
                {review.accountInsights.balances.map((account) => {
                  const institution = resolveInstitution(account.name);
                  const isGold = account.assetType === "gold";
                  const isSilver = account.assetType === "silver";
                  const displayName = account.type === "investment" ? account.name : (institution ? institution.name : account.name);
                  return (
                    <li
                      key={account.id}
                      className="flex items-center justify-between px-1 py-1.5 text-[15px]"
                    >
                      <span className="flex items-center gap-2">
                        <InstitutionIcon 
                          institution={isGold || isSilver ? null : institution} 
                          type={account.type} 
                          assetType={account.assetType}
                          size="xs" 
                        />
                        <span>{displayName}</span>
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(account.balance, currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
