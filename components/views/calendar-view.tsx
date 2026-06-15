"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpenseRow } from "@/components/expense-row";
import { EmptyState } from "@/components/empty-state";
import { useSheets } from "@/components/sheets/sheet-context";
import { resolveInstitution } from "@/lib/institutions/registry";
import { InstitutionIcon } from "@/components/institution-icon";
import { CATEGORIES, type Category } from "@/lib/domain/types";
import { filterExpenses } from "@/lib/domain/analytics";
import {
  maxDailyTotal,
  monthMatrix,
  weekDays,
  dailyTotalsMap,
} from "@/lib/domain/calendar";
import {
  addDays,
  currentMonth,
  formatDisplayMonth,
  formatFullDate,
  nextMonth,
  previousMonth,
  todayISO,
} from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import {
  upcomingEvents,
  upcomingDateSet,
  type UpcomingType,
} from "@/lib/domain/upcoming";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

const EVENT_LABELS: Record<UpcomingType, string> = {
  expense: "Bill",
  income: "Income",
  transfer: "Transfer",
  cc_payment: "Card payment",
  subscription: "Subscription",
  investment: "Investment",
  cc_due: "Card due",
};

type Mode = "month" | "week" | "day";
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ALL = "__all__";

export function CalendarView() {
  const expenses = useAppStore((state) => state.data.expenses);
  const accounts = useAppStore((state) => state.data.accounts);
  const subscriptions = useAppStore((state) => state.data.subscriptions);
  const recurring = useAppStore((state) => state.data.recurring);
  const recurringInvestments = useAppStore(
    (state) => state.data.recurringInvestments,
  );
  const currency = useAppStore((state) => state.data.settings.currency);
  const sheets = useSheets();

  const upcoming = useMemo(
    () =>
      upcomingEvents({
        recurring,
        subscriptions,
        recurringInvestments,
        accounts,
      }),
    [recurring, subscriptions, recurringInvestments, accounts],
  );
  const eventDates = useMemo(() => upcomingDateSet(upcoming), [upcoming]);

  const [mode, setMode] = useState<Mode>("month");
  const [month, setMonth] = useState(currentMonth());
  const [anchor, setAnchor] = useState(todayISO());
  const [category, setCategory] = useState<Category | "all">("all");
  const [accountId, setAccountId] = useState(ALL);
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      filterExpenses(expenses, {
        category: category === "all" ? null : category,
        accountId: accountId === ALL ? null : accountId,
      }),
    [expenses, category, accountId],
  );

  const matrix = useMemo(
    () => monthMatrix(month, filtered),
    [month, filtered],
  );
  const max = useMemo(() => maxDailyTotal(filtered) || 1, [filtered]);
  const totalsMap = useMemo(() => dailyTotalsMap(filtered), [filtered]);

  const selectedExpenses = useMemo(
    () =>
      selected
        ? filtered
            .filter((expense) => expense.date === selected)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [filtered, selected],
  );

  const intensity = (total: number) =>
    total <= 0 ? 0 : 0.12 + 0.6 * Math.min(1, total / max);

  const renderDayCell = (date: string, inMonth: boolean, total: number, count: number) => (
    <button
      key={date}
      type="button"
      onClick={() => setSelected(date)}
      aria-label={`${date} ${formatMoney(total, currency)}`}
      className={cn(
        "relative flex aspect-square flex-col items-center justify-center rounded-xl border text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        inMonth ? "border-border" : "border-transparent opacity-40",
        date === todayISO() ? "border-ring" : "",
      )}
      style={
        total > 0
          ? { backgroundColor: `color-mix(in oklch, var(--positive) ${Math.round(intensity(total) * 100)}%, transparent)` }
          : undefined
      }
    >
      <span className="font-medium">{Number(date.slice(8))}</span>
      {count > 0 && (
        <span className="text-[9px] tabular-nums text-foreground/80">
          {formatMoney(total, currency)}
        </span>
      )}
      {eventDates.has(date) && (
        <span
          aria-hidden
          className="absolute right-1 top-1 size-1.5 rounded-full bg-amber-400"
        />
      )}
    </button>
  );

  const week = useMemo(() => weekDays(anchor), [anchor]);

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList className="w-full">
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as Category | "all")}
        >
          <SelectTrigger className="h-9 flex-1 rounded-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="h-9 flex-1 rounded-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All accounts</SelectItem>
            {accounts
              .filter((account) => !account.archived)
              .map((account) => {
                const institution = resolveInstitution(account.name);
                return (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <InstitutionIcon institution={institution} type={account.type} size="xs" />
                      <span>{institution ? institution.name : account.name}</span>
                    </div>
                  </SelectItem>
                );
              })}
          </SelectContent>
        </Select>
      </div>

      {mode === "month" && (
        <>
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(previousMonth(month))}
              className="flex size-9 items-center justify-center rounded-full border border-border outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            <span className="text-[15px] font-medium">
              {formatDisplayMonth(month)}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(nextMonth(month))}
              className="flex size-9 items-center justify-center rounded-full border border-border outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {matrix.map((weekRow, index) => (
              <div key={index} className="grid grid-cols-7 gap-1">
                {weekRow.map((day) =>
                  renderDayCell(day.date, day.inMonth, day.total, day.count),
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {mode === "week" && (
        <ul className="flex flex-col gap-2">
          {week.map((day) => {
            const entry = totalsMap.get(day.date);
            return (
              <li key={day.date}>
                <button
                  type="button"
                  onClick={() => setSelected(day.date)}
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-card shadow-soft px-4 py-3.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-[14px]">{formatFullDate(day.date)}</span>
                  <span className="text-[14px] font-semibold tabular-nums">
                    {entry ? formatMoney(entry.total, currency) : "—"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {mode === "day" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setAnchor((d) => addDays(d, -1))}
              className="flex size-9 items-center justify-center rounded-full border border-border outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            <span className="text-[15px] font-medium">{formatFullDate(anchor)}</span>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => setAnchor((d) => addDays(d, 1))}
              className="flex size-9 items-center justify-center rounded-full border border-border outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </div>
          <DayList
            date={anchor}
            expenses={filtered.filter((e) => e.date === anchor)}
            onAdd={() => sheets.openExpense(undefined, { date: anchor })}
          />
        </div>
      )}

      {upcoming.length > 0 && (
        <section aria-label="Upcoming" className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-medium text-muted-foreground">
            Upcoming
          </h2>
          <ul className="flex flex-col gap-2">
            {upcoming.slice(0, 8).map((event) => (
              <li
                key={event.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-[11px] font-medium tabular-nums">
                  {Number(event.date.slice(8))}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-medium">
                    {event.title}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {EVENT_LABELS[event.type]} · {formatFullDate(event.date)}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-[15px] font-semibold tabular-nums",
                    event.type === "income" && "text-emerald-500",
                  )}
                >
                  {event.type === "income" ? "+" : ""}
                  {formatMoney(event.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selected ? formatFullDate(selected) : ""}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => {
                  const date = selected;
                  setSelected(null);
                  sheets.openExpense(undefined, { date });
                }}
              >
                <Plus aria-hidden />
                Add expense
              </Button>
              {selectedExpenses.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No expenses on this day.
                </p>
              ) : (
                <ul className="-mx-2 flex flex-col">
                  {selectedExpenses.map((expense) => (
                    <ExpenseRow key={expense.id} expense={expense} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DayList({
  date,
  expenses,
  onAdd,
}: {
  date: string;
  expenses: ReturnType<typeof useAppStore.getState>["data"]["expenses"];
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" onClick={onAdd}>
        <Plus aria-hidden />
        Add expense
      </Button>
      {expenses.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="Nothing on this day"
          description={`No expenses recorded for ${date}.`}
        />
      ) : (
        <ul className="-mx-2 flex flex-col">
          {expenses
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((expense) => (
              <ExpenseRow key={expense.id} expense={expense} />
            ))}
        </ul>
      )}
    </div>
  );
}
