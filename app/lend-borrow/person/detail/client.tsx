"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMoney } from "@/lib/domain/money";
import { formatDisplayDate } from "@/lib/domain/dates";
import { useAppStore } from "@/lib/store/app-store";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Handshake } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export function PersonDetailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "";
  const decodedName = decodeURIComponent(name);
  const lendBorrows = useAppStore((state) => state.data.lendBorrows);
  const settings = useAppStore((state) => state.data.settings);

  const personEntries = useMemo(
    () => lendBorrows.filter((i) => i.personName.toLowerCase() === decodedName.toLowerCase()),
    [lendBorrows, decodedName]
  );

  const metrics = useMemo(() => {
    let totalLent = 0;
    let totalBorrowed = 0;
    let totalLentRepaid = 0;
    let totalBorrowedRepaid = 0;

    for (const item of personEntries) {
      const repaid = item.repayments.reduce((sum, r) => sum + r.amount, 0);
      if (item.type === "lent") {
        totalLent += item.amount;
        totalLentRepaid += repaid;
      } else {
        totalBorrowed += item.amount;
        totalBorrowedRepaid += repaid;
      }
    }

    const outstandingLent = totalLent - totalLentRepaid;
    const outstandingBorrowed = totalBorrowed - totalBorrowedRepaid;

    return { totalLent, totalBorrowed, outstandingLent, outstandingBorrowed, net: outstandingLent - outstandingBorrowed };
  }, [personEntries]);

  return (
    <AppShell title={decodedName}>
      <div className="flex flex-col gap-6 pt-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-accent text-muted-foreground">
              <User className="size-5" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">{decodedName}</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-2xl bg-primary/10 p-4">
            <span className="text-[13px] font-medium text-primary">Total Lent</span>
            <span className="text-xl font-semibold text-primary">
              {formatMoney(metrics.totalLent, settings.currency)}
            </span>
            <span className="text-[12px] text-primary/70">
              Outstanding: {formatMoney(metrics.outstandingLent, settings.currency)}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-destructive/10 p-4">
            <span className="text-[13px] font-medium text-destructive">Total Borrowed</span>
            <span className="text-xl font-semibold text-destructive">
              {formatMoney(metrics.totalBorrowed, settings.currency)}
            </span>
            <span className="text-[12px] text-destructive/70">
              Outstanding: {formatMoney(metrics.outstandingBorrowed, settings.currency)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-2xl bg-accent p-4">
          <span className="text-[13px] font-medium text-muted-foreground">Net Position</span>
          <span className={cn("text-2xl font-semibold", metrics.net >= 0 ? "text-primary" : "text-destructive")}>
            {metrics.net >= 0 ? "+" : ""}{formatMoney(metrics.net, settings.currency)}
          </span>
          <span className="text-[12px] text-muted-foreground">
            {metrics.net > 0 ? `${decodedName} owes you` : metrics.net < 0 ? `You owe ${decodedName}` : "Settled up"}
          </span>
        </div>

        <h3 className="text-lg font-semibold tracking-tight mt-4">All Transactions</h3>

        {personEntries.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="No transactions"
            description={`You have no lend/borrow history with ${decodedName}.`}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {personEntries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => {
              const repaid = item.repayments.reduce((sum, r) => sum + r.amount, 0);
              const outstanding = item.amount - repaid;
              const progress = Math.min(100, Math.round((repaid / item.amount) * 100));
              
              let status = "Active";
              let statusClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400";
              if (outstanding <= 0) {
                status = "Settled";
                statusClass = "bg-green-500/10 text-green-600 dark:text-green-400";
              } else if (repaid > 0) {
                status = "Partially Settled";
                statusClass = "bg-orange-500/10 text-orange-600 dark:text-orange-400";
              } else if (item.dueDate && new Date(item.dueDate) < new Date()) {
                status = "Overdue";
                statusClass = "bg-destructive/10 text-destructive";
              }

              return (
                <Link
                  key={item.id}
                  href={`/lend-borrow/detail?id=${item.id}`}
                  className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent/50 active:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{item.description}</span>
                      <span className="text-[13px] text-muted-foreground capitalize">{item.type}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={cn("font-semibold", item.type === "lent" ? "text-primary" : "text-destructive")}>
                        {formatMoney(item.amount, settings.currency)}
                      </span>
                      <span className="text-[12px] text-muted-foreground">{formatDisplayDate(item.date)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <div className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusClass)}>
                      {status}
                    </div>
                  </div>

                  {item.amount > 0 && (
                    <div className="mt-1 flex flex-col gap-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{progress}% repaid</span>
                        <span>{formatMoney(outstanding, settings.currency)} left</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", status === "Settled" ? "bg-green-500" : item.type === "lent" ? "bg-primary" : "bg-destructive")}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
