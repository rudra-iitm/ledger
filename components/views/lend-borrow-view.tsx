"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/domain/money";
import { formatDisplayDate } from "@/lib/domain/dates";
import { useAppStore } from "@/lib/store/app-store";
import { Handshake, User, Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export function LendBorrowView() {
  const lendBorrows = useAppStore((state) => state.data.lendBorrows);
  const settings = useAppStore((state) => state.data.settings);

  const [activeTab, setActiveTab] = useState<"lent" | "borrowed">("lent");

  const metrics = useMemo(() => {
    let totalLent = 0;
    let totalBorrowed = 0;
    let totalLentRepaid = 0;
    let totalBorrowedRepaid = 0;

    for (const item of lendBorrows) {
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

    return { outstandingLent, outstandingBorrowed, net: outstandingLent - outstandingBorrowed };
  }, [lendBorrows]);

  const filtered = useMemo(() => {
    return lendBorrows.filter(item => item.type === activeTab).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [lendBorrows, activeTab]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-2xl bg-primary/10 p-4">
          <span className="text-[13px] font-medium text-primary">Money Lent</span>
          <span className="text-2xl font-semibold text-primary">
            {formatMoney(metrics.outstandingLent, settings.currency)}
          </span>
          <span className="text-[12px] text-primary/70">Expected Back</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl bg-destructive/10 p-4">
          <span className="text-[13px] font-medium text-destructive">Money Borrowed</span>
          <span className="text-2xl font-semibold text-destructive">
            {formatMoney(metrics.outstandingBorrowed, settings.currency)}
          </span>
          <span className="text-[12px] text-destructive/70">Need to Repay</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-2xl bg-accent p-4">
        <span className="text-[13px] font-medium text-muted-foreground">Net Position</span>
        <span className={cn("text-2xl font-semibold", metrics.net >= 0 ? "text-primary" : "text-destructive")}>
          {metrics.net >= 0 ? "+" : ""}{formatMoney(metrics.net, settings.currency)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "lent" | "borrowed")} className="flex-1">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="lent">Lent</TabsTrigger>
            <TabsTrigger value="borrowed">Borrowed</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button size="icon" className="shrink-0 rounded-xl" asChild>
          <Link href="/lend-borrow/new">
            <Plus className="size-5" />
          </Link>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title={activeTab === "lent" ? "No money lent" : "No money borrowed"}
          description={activeTab === "lent" ? "You haven't lent any money yet." : "You haven't borrowed any money."}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => {
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
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-accent text-muted-foreground">
                      <User className="size-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{item.personName}</span>
                      <span className="text-[13px] text-muted-foreground">{item.description}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-semibold">{formatMoney(item.amount, settings.currency)}</span>
                    <span className="text-[12px] text-muted-foreground">{formatDisplayDate(item.date)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1">
                  <div className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusClass)}>
                    {status}
                  </div>
                  {outstanding > 0 && item.dueDate && (
                    <span className="text-[12px] text-muted-foreground">
                      Due: {formatDisplayDate(item.dueDate)}
                    </span>
                  )}
                </div>

                {item.amount > 0 && (
                  <div className="mt-1 flex flex-col gap-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{progress}% repaid</span>
                      <span>{formatMoney(outstanding, settings.currency)} left</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", status === "Settled" ? "bg-green-500" : activeTab === "lent" ? "bg-primary" : "bg-destructive")}
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
  );
}
