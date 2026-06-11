"use client";

import { useMemo } from "react";
import { Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { useSheets } from "@/components/sheets/sheet-context";
import { BILLING_LABELS } from "@/components/sheets/subscription-sheet";
import {
  monthlyCost,
  totalAnnualCost,
  totalMonthlyCost,
  upcomingRenewals,
} from "@/lib/domain/subscriptions";
import { formatDisplayDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import type { Subscription } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-4 py-3.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function SubscriptionsView() {
  const subscriptions = useAppStore((state) => state.data.subscriptions);
  const currency = useAppStore((state) => state.data.settings.currency);
  const sheets = useSheets();

  const active = subscriptions.filter((s) => s.active);
  const monthlyTotal = totalMonthlyCost(subscriptions);
  const annualTotal = totalAnnualCost(subscriptions);

  const upcoming = useMemo(() => upcomingRenewals(active, 30), [active]);
  const renewingSoon = upcoming.filter((entry) => entry.daysAway <= 7);

  const sorted = [...subscriptions].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.nextRenewalDate.localeCompare(b.nextRenewalDate);
  });

  const renewLabel = (sub: Subscription) =>
    `${formatMoney(sub.amount, currency)} · ${BILLING_LABELS[sub.billingCycle]}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">
          {active.length} active
        </h2>
        <Button size="sm" onClick={() => sheets.openSubscription()}>
          <Plus aria-hidden />
          New
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Monthly cost" value={formatMoney(monthlyTotal, currency)} />
        <Stat label="Annual cost" value={formatMoney(annualTotal, currency)} />
      </div>

      {renewingSoon.length > 0 && (
        <section aria-label="Renewing soon" className="flex flex-col gap-2">
          {renewingSoon.map(({ subscription, daysAway }) => (
            <button
              key={subscription.id}
              type="button"
              onClick={() => sheets.openSubscription(subscription)}
              className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <TriangleAlert aria-hidden className="size-4 shrink-0 text-amber-400" />
              <span className="flex-1 text-[14px]">
                {subscription.name} renews{" "}
                {daysAway === 0
                  ? "today"
                  : daysAway === 1
                    ? "tomorrow"
                    : `in ${daysAway} days`}
              </span>
              <span className="text-[13px] font-medium tabular-nums">
                {formatMoney(subscription.amount, currency)}
              </span>
            </button>
          ))}
        </section>
      )}

      {subscriptions.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="No subscriptions"
          description="Track Netflix, Spotify, and other recurring services in one place."
        />
      ) : (
        <section aria-label="All subscriptions">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            All subscriptions
          </h3>
          <ul className="flex flex-col gap-2">
            {sorted.map((subscription) => (
              <li key={subscription.id}>
                <button
                  type="button"
                  onClick={() => sheets.openSubscription(subscription)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring",
                    !subscription.active && "opacity-60",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-medium">
                      {subscription.name}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {subscription.active
                        ? `Renews ${formatDisplayDate(subscription.nextRenewalDate)}`
                        : "Paused"}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-[15px] font-semibold tabular-nums">
                      {renewLabel(subscription)}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      {formatMoney(monthlyCost(subscription), currency)}/mo
                    </span>
                  </span>
                  {!subscription.active && <Badge variant="outline">Paused</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
