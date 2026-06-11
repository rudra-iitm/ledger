"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, LayoutGrid, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { useSheets } from "@/components/sheets/sheet-context";
import { spaceSummary } from "@/lib/domain/spaces";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function SpacesView() {
  const spaces = useAppStore((state) => state.data.spaces);
  const expenses = useAppStore((state) => state.data.expenses);
  const currency = useAppStore((state) => state.data.settings.currency);
  const sheets = useSheets();
  const [showArchived, setShowArchived] = useState(false);

  const visible = spaces.filter((space) => space.archived === showArchived);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-[13px]">
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            className={cn(
              "rounded-full px-3 py-1.5 outline-none transition-colors",
              !showArchived ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setShowArchived(true)}
            className={cn(
              "rounded-full px-3 py-1.5 outline-none transition-colors",
              showArchived ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            Archived
          </button>
        </div>
        <Button size="sm" onClick={() => sheets.openSpace()}>
          <Plus aria-hidden />
          New
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title={showArchived ? "No archived spaces" : "No spaces yet"}
          description="Group related expenses — trips, projects, big purchases — into a Space."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((space) => {
            const summary = spaceSummary(expenses, space);
            return (
              <li key={space.id}>
                <Link
                  href={`/space/?id=${space.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="text-2xl">
                      {space.icon}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-medium">
                        {space.name}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        {summary.count} {summary.count === 1 ? "expense" : "expenses"}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[15px] font-semibold tabular-nums">
                        {formatMoney(summary.spent, currency)}
                      </span>
                      {space.budget > 0 && (
                        <span className="text-[12px] text-muted-foreground">
                          of {formatMoney(space.budget, currency)}
                        </span>
                      )}
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  </div>
                  {space.budget > 0 && (
                    <Progress
                      value={summary.progress * 100}
                      indicatorClassName={cn(summary.overBudget && "bg-destructive")}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
