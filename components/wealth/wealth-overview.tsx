"use client";

/**
 * The wealth overview.
 *
 * The investments screen already answered "what do I own and what is it
 * worth". This answers the three questions it didn't: what *shape* is my
 * money in, how much of that number is real, and where does it land if
 * nothing changes.
 *
 * Every figure comes from `lib/domain/wealth`. Nothing here is model-authored,
 * because these are the numbers someone might make an actual investment
 * decision on — and because a projection that quietly came from an LLM is a
 * liability, not a feature.
 *
 * The deliberate omission is advice. We say one holding is 68% of the
 * portfolio; we never say to sell it. Ledger is not a licensed adviser and
 * must not read like one.
 */

import { useMemo } from "react";
import { formatMoney } from "@/lib/domain/money";
import {
  wealthReport,
  type AllocationSlice,
  type NetWorthProjection,
} from "@/lib/domain/wealth";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

/** Fixed hues per class so the bar and the legend can never disagree. */
const CLASS_COLOR: Record<string, string> = {
  equity: "bg-emerald-500",
  commodity: "bg-amber-400",
  crypto: "bg-violet-500",
  other: "bg-slate-500",
};

function AllocationBar({ slices }: { slices: AllocationSlice[] }) {
  if (slices.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={slices
          .map((slice) => `${slice.label} ${Math.round(slice.share * 100)}%`)
          .join(", ")}
      >
        {slices.map((slice) => (
          <span
            key={slice.assetClass}
            className={cn("h-full", CLASS_COLOR[slice.assetClass])}
            style={{ width: `${slice.share * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {slices.map((slice) => (
          <li key={slice.assetClass} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", CLASS_COLOR[slice.assetClass])}
            />
            <span className="text-[12px] text-muted-foreground">
              {slice.label} {Math.round(slice.share * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One sentence about the future, with its own footnote.
 *
 * The basis line is not decoration. A projection built on three months of
 * history and one built on a standing instruction are different claims, and
 * the user is entitled to know which one they're reading.
 */
function ProjectionLine({
  projection,
  currency,
}: {
  projection: NetWorthProjection;
  currency: string;
}) {
  if (projection.basis === "none") return null;

  const rising = projection.projected >= projection.current;
  const basis =
    projection.basis === "trend"
      ? `based on ${projection.snapshotsUsed} months of your own history`
      : `based only on ${formatMoney(projection.scheduledContribution, currency)}/mo you've scheduled`;

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[13px]">
        <span className="text-muted-foreground">In {projection.months} months, </span>
        <span className={cn("font-medium tabular-nums", !rising && "text-destructive")}>
          {formatMoney(projection.projected, currency)}
        </span>
      </p>
      <p className="text-[12px] text-muted-foreground">
        {rising ? "+" : ""}
        {formatMoney(projection.monthlyChange, currency)}/mo · {basis}
      </p>
    </div>
  );
}

export function WealthOverview() {
  const accounts = useAppStore((state) => state.data.accounts);
  const expenses = useAppStore((state) => state.data.expenses);
  const snapshots = useAppStore((state) => state.data.snapshots);
  const recurringInvestments = useAppStore((state) => state.data.recurringInvestments);
  const currency = useAppStore((state) => state.data.settings.currency);

  const report = useMemo(
    () => wealthReport({ accounts, expenses, snapshots, recurringInvestments }),
    [accounts, expenses, snapshots, recurringInvestments],
  );

  // Nothing owned and nothing owed is not a wealth picture — say nothing
  // rather than render a row of zeroes.
  if (report.assets === 0 && report.liabilities === 0) return null;

  const { coverage, concentration: risk } = report;
  const unpricedShare = Math.round((1 - coverage.pricedShare) * 100);

  return (
    <section
      aria-label="Net worth"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-5 py-5 shadow-soft"
    >
      <div>
        <p className="text-[13px] text-muted-foreground">Net worth</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {formatMoney(report.netWorth, currency)}
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">
          {formatMoney(report.assets, currency)} assets
          {report.liabilities > 0 && <> · {formatMoney(report.liabilities, currency)} owed</>}
        </p>
      </div>

      <ProjectionLine projection={report.projection} currency={currency} />

      {report.allocation.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
          {/*
            The portfolio's own value lives here rather than in a second card
            below. Two hero numbers on one screen means neither is the answer
            to "how am I doing" — net worth is, and this is a component of it.
          */}
          <p className="text-[13px]">
            <span className="text-muted-foreground">Invested </span>
            <span className="tabular-nums">
              {formatMoney(report.portfolio.invested, currency)}
            </span>
            <span className="text-muted-foreground"> · now </span>
            <span className="tabular-nums">
              {formatMoney(report.portfolio.currentValue, currency)}
            </span>
            {report.portfolio.invested > 0 && (
              <span
                className={cn(
                  "font-medium tabular-nums",
                  report.portfolio.gain >= 0 ? "text-emerald-500" : "text-destructive",
                )}
              >
                {" "}
                ({report.portfolio.gain >= 0 ? "+" : ""}
                {report.portfolio.gainPercent}%)
              </span>
            )}
          </p>
          <AllocationBar slices={report.allocation} />
          {risk.topHolding && report.portfolio.holdings.length > 1 && (
            <p className="text-[12px] text-muted-foreground">
              Largest holding {risk.topHolding.account.name} at{" "}
              {Math.round(risk.topHoldingShare * 100)}% · effectively{" "}
              {risk.effectiveHoldings.toFixed(1)} holdings
            </p>
          )}
          {unpricedShare > 0 && (
            /*
             * Say this wherever any of the portfolio is unpriced, not just past
             * the signal's threshold. On this screen the gain figure is right
             * next to it, and a return computed partly from purchase prices
             * should never look like a measured one.
             */
            <p className="text-[12px] text-muted-foreground">
              {unpricedShare}% has no live price and is counted at cost.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
