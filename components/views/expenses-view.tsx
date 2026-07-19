"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, ReceiptText, Search, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ExpenseRow } from "@/components/expense-row";
import {
  TimeRangePicker,
  type TimeFilterValue,
} from "@/components/fields/time-range-picker";
import { resolveInstitution } from "@/lib/institutions/registry";
import { InstitutionIcon } from "@/components/institution-icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  CATEGORIES,
  type AssetType,
  type Category,
} from "@/lib/domain/types";
import { filterExpenses, totalSpending } from "@/lib/domain/analytics";
import { isInvestment, visibleInExpenseList } from "@/lib/domain/transactions";
import { ShowInvestmentsToggle } from "@/components/fields/show-investments-toggle";
import { resolveRange, type TimePreset } from "@/lib/domain/time-ranges";
import { formatDisplayDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

const SORT_LABELS: Record<SortKey, string> = {
  "date-desc": "Newest first",
  "date-asc": "Oldest first",
  "amount-desc": "Highest amount",
  "amount-asc": "Lowest amount",
};

const PAGE_SIZE = 25;
const ALL_ACCOUNTS = "__all__";
const ALL_SPACES = "__all_spaces__";

interface ExpensesViewProps {
  scope?: "all" | "investments";
  initialCategory?: Category | null;
  initialPreset?: TimePreset | null;
  initialQuery?: string;
}

export function ExpensesView({
  scope = "all",
  initialCategory = null,
  initialPreset = null,
  initialQuery = "",
}: ExpensesViewProps = {}) {
  const investmentsOnly = scope === "investments";
  const noun = investmentsOnly ? "transaction" : "expense";
  const expenses = useAppStore((state) => state.data.expenses);
  const settings = useAppStore((state) => state.data.settings);
  const accounts = useAppStore((state) => state.data.accounts);
  const spaces = useAppStore((state) => state.data.spaces);

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<Category | null>(initialCategory);
  const [assetType, setAssetType] = useState<AssetType | null>(null);
  const [accountId, setAccountId] = useState(ALL_ACCOUNTS);
  const [spaceId, setSpaceId] = useState(ALL_SPACES);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [time, setTime] = useState<TimeFilterValue>({
    preset: initialPreset ?? "all",
    custom: { start: null, end: null },
  });
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const range = useMemo(() => resolveRange(time.preset, time.custom), [time]);

  const assetTypeByAccount = useMemo(() => {
    const map = new Map<string, AssetType>();
    for (const account of accounts) {
      if (account.assetType) map.set(account.id, account.assetType);
    }
    return map;
  }, [accounts]);

  const assetTypeOf = useCallback(
    (expense: { transferAccountId?: string }) =>
      expense.transferAccountId
        ? assetTypeByAccount.get(expense.transferAccountId)
        : undefined,
    [assetTypeByAccount],
  );

  const presentAssetTypes = useMemo(() => {
    if (!investmentsOnly) return [];
    const present = new Set<AssetType>();
    for (const expense of expenses) {
      if (!isInvestment(expense)) continue;
      const type = assetTypeOf(expense);
      if (type) present.add(type);
    }
    return ASSET_TYPES.filter((type) => present.has(type));
  }, [investmentsOnly, expenses, assetTypeOf]);

  const filtered = useMemo(() => {
    const matched = filterExpenses(expenses, {
      range,
      category,
      accountId: accountId === ALL_ACCOUNTS ? null : accountId,
      spaceId: spaceId === ALL_SPACES ? null : spaceId,
      tags: activeTags,
      query,
    });
    const result = investmentsOnly
      ? matched
          .filter(isInvestment)
          .filter((expense) => !assetType || assetTypeOf(expense) === assetType)
      : visibleInExpenseList(matched, settings.showInvestmentsInExpenses);
    return result.sort((a, b) => {
      switch (sort) {
        case "date-asc":
          return a.date === b.date
            ? a.createdAt.localeCompare(b.createdAt)
            : a.date.localeCompare(b.date);
        case "amount-desc":
          return b.amount - a.amount;
        case "amount-asc":
          return a.amount - b.amount;
        case "date-desc":
        default:
          return a.date === b.date
            ? b.createdAt.localeCompare(a.createdAt)
            : b.date.localeCompare(a.date);
      }
    });
  }, [
    expenses,
    range,
    category,
    accountId,
    spaceId,
    activeTags,
    query,
    sort,
    settings.showInvestmentsInExpenses,
    investmentsOnly,
    assetType,
    assetTypeOf,
  ]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [range, category, assetType, accountId, spaceId, activeTags, query, sort]);

  const page = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;
  const hasInvestments = useMemo(
    () => expenses.some(isInvestment),
    [expenses],
  );

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setVisible((current) => current + PAGE_SIZE);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore]);

  const grouped = useMemo(() => {
    if (sort !== "date-desc" && sort !== "date-asc") return null;
    const groups = new Map<string, typeof page>();
    for (const expense of page) {
      const list = groups.get(expense.date) ?? [];
      list.push(expense);
      groups.set(expense.date, list);
    }
    return Array.from(groups.entries());
  }, [page, sort]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-2xl border border-input bg-card px-3.5 transition-colors focus-within:border-ring">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search expenses"
          placeholder="Search description, tag, or note"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-10 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TimeRangePicker value={time} onChange={setTime} />
        {!investmentsOnly && hasInvestments && (
          <ShowInvestmentsToggle className="order-last ml-auto" />
        )}
        <Popover>
          <PopoverTrigger className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            <SlidersHorizontal aria-hidden className="size-4" />
            <span className="sr-only">Filters</span>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-muted-foreground">
                  Account
                </span>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_ACCOUNTS}>All accounts</SelectItem>
                    {accounts
                      .filter((account) => !account.archived)
                      .map((account) => {
                        const institution = resolveInstitution(account.name);
                        const isGold = account.assetType === "gold";
                        const isSilver = account.assetType === "silver";
                        const displayName = account.type === "investment" ? account.name : (institution ? institution.name : account.name);
                        return (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center gap-2">
                              <InstitutionIcon 
                                institution={isGold || isSilver ? null : institution} 
                                type={account.type} 
                                assetType={account.assetType}
                                size="xs" 
                              />
                              <span>{displayName}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              {spaces.filter((space) => !space.archived).length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted-foreground">
                    Space
                  </span>
                  <Select value={spaceId} onValueChange={setSpaceId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_SPACES}>All spaces</SelectItem>
                      {spaces
                        .filter((space) => !space.archived)
                        .map((space) => (
                          <SelectItem key={space.id} value={space.id}>
                            {space.icon} {space.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {settings.tags.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-muted-foreground">
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {settings.tags.map((tag) => {
                      const active = activeTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            setActiveTags((current) =>
                              active
                                ? current.filter((item) => item !== tag)
                                : [...current, tag],
                            )
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[13px] outline-none transition-colors",
                            active
                              ? "border-transparent bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowDownUp aria-hidden className="size-4" />
            <span className="sr-only">Sort</span>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52">
            <div className="flex flex-col">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-accent",
                    sort === key && "text-foreground",
                    sort !== key && "text-muted-foreground",
                  )}
                >
                  {SORT_LABELS[key]}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {investmentsOnly ? (
        presentAssetTypes.length > 0 && (
          <div
            role="group"
            aria-label="Filter by asset type"
            className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]"
          >
            {[null, ...presentAssetTypes].map((item) => {
              const selected = assetType === item;
              return (
                <button
                  key={item ?? "all"}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAssetType(item)}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item ? ASSET_TYPE_LABELS[item] : "All"}
                </button>
              );
            })}
          </div>
        )
      ) : (
        <div
          role="group"
          aria-label="Filter by category"
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]"
        >
          {[null, ...CATEGORIES].map((item) => {
            const selected = category === item;
            return (
              <button
                key={item ?? "all"}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategory(item)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {item ?? "All"}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={
            investmentsOnly
              ? "No investment transactions"
              : expenses.length === 0
                ? "No expenses yet"
                : "Nothing matches"
          }
          description={
            investmentsOnly
              ? "Record an investment to see it here, or adjust your filters."
              : expenses.length === 0
                ? "Tap the plus button to add your first expense."
                : "Try a different search, time range, or filter."
          }
        />
      ) : (
        <>
          <p className="px-1 text-[13px] text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? noun : `${noun}s`} ·{" "}
            {formatMoney(totalSpending(filtered), settings.currency)}
          </p>

          {grouped ? (
            <div className="flex flex-col gap-5">
              {grouped.map(([date, items]) => (
                <section key={date} aria-label={formatDisplayDate(date)}>
                  <h2 className="mb-1 px-0.5 text-[13px] font-medium text-muted-foreground">
                    {formatDisplayDate(date)}
                  </h2>
                  <ul className="-mx-2 flex flex-col">
                    {items.map((expense) => (
                      <ExpenseRow key={expense.id} expense={expense} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {page.map((expense) => (
                <ExpenseRow key={expense.id} expense={expense} />
              ))}
            </ul>
          )}

          {hasMore && (
            <div ref={sentinelRef} className="h-10" aria-hidden />
          )}
        </>
      )}
    </div>
  );
}
