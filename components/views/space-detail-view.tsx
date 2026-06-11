"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutGrid, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttachmentGallery } from "@/components/attachment-gallery";
import { EmptyState } from "@/components/empty-state";
import { ExpenseRow } from "@/components/expense-row";
import { useSheets } from "@/components/sheets/sheet-context";
import { CATEGORY_COLORS } from "@/lib/domain/category-meta";
import {
  breakdownByCategory,
  bucketedTotals,
  filterExpenses,
  type Granularity,
} from "@/lib/domain/analytics";
import { spaceExpenses, spaceSummary } from "@/lib/domain/spaces";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

const CategoryDonut = dynamic(
  () => import("@/components/charts/category-donut").then((m) => m.CategoryDonut),
  { ssr: false, loading: () => <Skeleton className="mx-auto size-48 rounded-full" /> },
);

const SpendBars = dynamic(
  () => import("@/components/charts/spend-bars").then((m) => m.SpendBars),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> },
);

const GRANULARITIES: Granularity[] = ["day", "week", "month"];
const GRAN_LABELS: Record<Granularity, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-4 py-3.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={cn("text-lg font-semibold tabular-nums", tone)}>{value}</span>
    </div>
  );
}

export function SpaceDetailView() {
  const searchParams = useSearchParams();
  const spaceId = searchParams.get("id");
  const space = useAppStore((state) =>
    state.data.spaces.find((item) => item.id === spaceId),
  );
  const expenses = useAppStore((state) => state.data.expenses);
  const currency = useAppStore((state) => state.data.settings.currency);
  const sheets = useSheets();

  const [query, setQuery] = useState("");
  const [granularity, setGranularity] = useState<Granularity>("day");

  const owned = useMemo(
    () => (space ? spaceExpenses(expenses, space.id) : []),
    [expenses, space],
  );
  const breakdown = useMemo(() => breakdownByCategory(owned), [owned]);
  const series = useMemo(
    () => bucketedTotals(owned, granularity),
    [owned, granularity],
  );
  const searched = useMemo(
    () =>
      filterExpenses(owned, { query }).sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [owned, query],
  );
  const attachments = useMemo(
    () => owned.flatMap((expense) => expense.attachments),
    [owned],
  );

  if (!space) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="Space not found"
        description="It may have been deleted on another device."
      />
    );
  }

  const summary = spaceSummary(expenses, space);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href="/spaces"
          className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Spaces
        </Link>
        <Button variant="ghost" size="sm" onClick={() => sheets.openSpace(space)}>
          <Pencil aria-hidden />
          Edit
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-3xl">
            {space.icon}
          </span>
          <h2 className="text-2xl font-semibold tracking-tight">{space.name}</h2>
        </div>
        {space.description && (
          <p className="mt-2 text-[14px] text-muted-foreground">
            {space.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Spent" value={formatMoney(summary.spent, currency)} />
        <Stat
          label="Budget"
          value={space.budget > 0 ? formatMoney(space.budget, currency) : "—"}
        />
        <Stat
          label="Remaining"
          value={space.budget > 0 ? formatMoney(summary.remaining, currency) : "—"}
          tone={summary.overBudget ? "text-destructive" : undefined}
        />
        <Stat label="Expenses" value={String(summary.count)} />
      </div>
      {space.budget > 0 && (
        <Progress
          value={summary.progress * 100}
          indicatorClassName={cn(summary.overBudget && "bg-destructive")}
        />
      )}

      <Button onClick={() => sheets.openExpense(undefined, { spaceId: space.id })}>
        <Plus aria-hidden />
        Add expense to {space.name}
      </Button>

      <Tabs defaultValue="overview">
        <TabsList className="w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {owned.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              title="No expenses yet"
              description="Add the first expense to this space."
            />
          ) : (
            <div className="flex flex-col gap-6">
              <CategoryDonut
                data={breakdown}
                total={summary.spent}
                currency={currency}
              />
              <ul className="flex flex-col gap-1">
                {breakdown.map((entry) => (
                  <li
                    key={entry.category}
                    className="flex items-center gap-3 px-1 py-1.5"
                  >
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[entry.category] }}
                    />
                    <span className="flex-1 text-[15px]">{entry.category}</span>
                    <span className="text-[13px] text-muted-foreground">
                      {Math.round(entry.percentage)}%
                    </span>
                    <span className="w-20 text-right text-[15px] font-semibold tabular-nums">
                      {formatMoney(entry.total, currency)}
                    </span>
                  </li>
                ))}
              </ul>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Spending over time
                  </h3>
                  <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-[12px]">
                    {GRANULARITIES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGranularity(g)}
                        className={cn(
                          "rounded-full px-2.5 py-1 outline-none transition-colors",
                          granularity === g
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {GRAN_LABELS[g]}
                      </button>
                    ))}
                  </div>
                </div>
                <SpendBars data={series} />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="expenses">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-2xl border border-input bg-card px-3.5 focus-within:border-ring">
              <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                aria-label="Search space expenses"
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
            </div>
            {searched.length === 0 ? (
              <EmptyState
                icon={LayoutGrid}
                title="Nothing here"
                description="No expenses match."
              />
            ) : (
              <ul className="-mx-2 flex flex-col">
                {searched.map((expense) => (
                  <ExpenseRow key={expense.id} expense={expense} />
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="files">
          {attachments.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              title="No attachments"
              description="Receipts and files attached to this space's expenses appear here."
            />
          ) : (
            <AttachmentGallery attachments={attachments} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
