"use client";

import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { formatMoney, roundMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";

export function GroupsView() {
  const groups = useAppStore((state) => state.data.groups);
  const currency = useAppStore((state) => state.data.settings.currency);

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No groups yet"
        description="Create a group from the plus button to split bills with friends."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {groups.map((group) => {
        const total = roundMoney(
          group.expenses.reduce((sum, expense) => sum + expense.amount, 0),
        );
        return (
          <li key={group.id}>
            <Link
              href={`/group/?id=${group.id}`}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-xl border border-border bg-secondary"
              >
                <Users className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium">
                  {group.name}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {group.members.length} members ·{" "}
                  {group.expenses.length === 0
                    ? "No expenses"
                    : `${formatMoney(total, currency)} total`}
                </span>
              </span>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
