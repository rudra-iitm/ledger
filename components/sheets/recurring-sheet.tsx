"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountSelect } from "@/components/fields/account-select";
import { DateField } from "@/components/fields/date-field";
import {
  CATEGORIES,
  INCOME_CATEGORIES,
  RECURRENCE_FREQUENCIES,
  categorySchema,
  incomeCategorySchema,
  recurrenceFrequencySchema,
  type Category,
  type IncomeCategory,
  type RecurrenceFrequency,
  type RecurringExpense,
} from "@/lib/domain/types";
import { todayISO, weekdayOf } from "@/lib/domain/dates";
import { useAppStore } from "@/lib/store/app-store";

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Kind = "expense" | "income" | "transfer" | "cc_payment";

const KIND_LABELS: Record<Kind, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  cc_payment: "Card bill",
};

export function RecurringSheet({
  open,
  recurring,
  onClose,
}: {
  open: boolean;
  recurring?: RecurringExpense;
  onClose: () => void;
}) {
  const addRecurring = useAppStore((state) => state.addRecurring);
  const updateRecurring = useAppStore((state) => state.updateRecurring);
  const deleteRecurring = useAppStore((state) => state.deleteRecurring);
  const accounts = useAppStore((state) => state.data.accounts);

  const [kind, setKind] = useState<Kind>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Bills");
  const [incomeCategory, setIncomeCategory] = useState<IncomeCategory>("Salary");
  const [source, setSource] = useState("");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [weekday, setWeekday] = useState("1");
  const [startDate, setStartDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<string | undefined>();
  const [destinationAccountId, setDestinationAccountId] = useState<
    string | undefined
  >();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (recurring) {
      setKind(recurring.kind ?? "expense");
      setDescription(recurring.description);
      setAmount(String(recurring.amount));
      setCategory(recurring.category);
      setIncomeCategory(recurring.incomeCategory ?? "Salary");
      setSource(recurring.source ?? "");
      setFrequency(recurring.frequency);
      setDayOfMonth(String(recurring.dayOfMonth));
      setWeekday(String(recurring.weekday ?? weekdayOf(recurring.startDate)));
      setStartDate(recurring.startDate);
      setAccountId(recurring.accountId);
      setDestinationAccountId(recurring.transferAccountId);
    } else {
      setKind("expense");
      setDescription("");
      setAmount("");
      setCategory("Bills");
      setIncomeCategory("Salary");
      setSource("");
      setFrequency("monthly");
      setDayOfMonth("1");
      setWeekday("1");
      setStartDate(todayISO());
      setAccountId(undefined);
      setDestinationAccountId(undefined);
    }
    setError(null);
  }, [open, recurring]);

  const cards = accounts.filter(
    (account) => account.type === "credit_card" && !account.archived,
  );

  const submit = () => {
    const parsedAmount = Number(amount);
    if (!description.trim()) {
      setError("Add a description");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    if (
      (kind === "transfer" || kind === "cc_payment") &&
      (!destinationAccountId || destinationAccountId === "none")
    ) {
      setError(kind === "transfer" ? "Pick a destination" : "Pick a card");
      return;
    }

    const payload = {
      kind,
      description: description.trim(),
      amount: parsedAmount,
      category: kind === "expense" ? category : ("Bills" as Category),
      incomeCategory: kind === "income" ? incomeCategory : undefined,
      source: kind === "income" ? source.trim() || undefined : undefined,
      transferAccountId:
        kind === "transfer" || kind === "cc_payment"
          ? destinationAccountId
          : undefined,
      frequency,
      dayOfMonth: Math.min(31, Math.max(1, Number(dayOfMonth) || 1)),
      weekday: frequency === "weekly" ? Number(weekday) : undefined,
      startDate,
      accountId,
    };

    if (recurring) {
      updateRecurring(recurring.id, payload);
      toast.success("Recurring updated");
    } else {
      addRecurring({ ...payload, active: true });
      toast.success("Recurring added");
    }
    onClose();
  };

  const accountLabel =
    kind === "income" ? "Deposit to" : kind === "expense" ? "Paid via" : "From";

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{recurring ? "Edit recurring" : "Add recurring"}</SheetTitle>
          <SheetDescription>
            Posted automatically when each occurrence is due.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Tabs value={kind} onValueChange={(value) => setKind(value as Kind)}>
            <TabsList className="w-full">
              {(Object.keys(KIND_LABELS) as Kind[]).map((item) => (
                <TabsTrigger key={item} value={item} className="text-[13px]">
                  {KIND_LABELS[item]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-2">
            <Label htmlFor="recurring-description">Description</Label>
            <Input
              id="recurring-description"
              placeholder={kind === "income" ? "Salary" : "Rent"}
              autoComplete="off"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="recurring-amount">Amount</Label>
              <Input
                id="recurring-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="15000"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="recurring-frequency">Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(value) =>
                  setFrequency(recurrenceFrequencySchema.parse(value))
                }
              >
                <SelectTrigger id="recurring-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_FREQUENCIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {FREQUENCY_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            {kind === "expense" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="recurring-category">Category</Label>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    setCategory(categorySchema.parse(value))
                  }
                >
                  <SelectTrigger id="recurring-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {kind === "income" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="recurring-income-category">Category</Label>
                <Select
                  value={incomeCategory}
                  onValueChange={(value) =>
                    setIncomeCategory(incomeCategorySchema.parse(value))
                  }
                >
                  <SelectTrigger id="recurring-income-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(frequency === "monthly" || frequency === "yearly") && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="recurring-day">Day of month</Label>
                <Input
                  id="recurring-day"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(event) => setDayOfMonth(event.target.value)}
                />
              </div>
            )}

            {frequency === "weekly" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="recurring-weekday">Weekday</Label>
                <Select value={weekday} onValueChange={setWeekday}>
                  <SelectTrigger id="recurring-weekday">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((label, index) => (
                      <SelectItem key={label} value={String(index)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {kind === "income" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="recurring-source">Source</Label>
              <Input
                id="recurring-source"
                placeholder="Employer, client…"
                value={source}
                onChange={(event) => setSource(event.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="recurring-account">{accountLabel}</Label>
              <AccountSelect
                id="recurring-account"
                value={accountId}
                onChange={setAccountId}
                allowNone={kind === "expense" || kind === "income"}
              />
            </div>
            {kind === "transfer" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="recurring-destination">To</Label>
                <AccountSelect
                  id="recurring-destination"
                  value={destinationAccountId}
                  onChange={setDestinationAccountId}
                  allowNone={false}
                />
              </div>
            )}
            {kind === "cc_payment" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="recurring-card">Card</Label>
                <Select
                  value={destinationAccountId}
                  onValueChange={setDestinationAccountId}
                >
                  <SelectTrigger id="recurring-card">
                    <SelectValue placeholder="Select card" />
                  </SelectTrigger>
                  <SelectContent>
                    {cards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="recurring-start">Starts</Label>
            <DateField
              id="recurring-start"
              value={startDate}
              onChange={(next) => next && setStartDate(next)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-1 flex flex-col gap-2">
            <Button type="submit" size="lg">
              {recurring ? "Save changes" : "Add recurring"}
            </Button>
            {recurring && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    updateRecurring(recurring.id, { active: !recurring.active });
                    toast.success(
                      recurring.active ? "Recurring paused" : "Recurring resumed",
                    );
                    onClose();
                  }}
                >
                  {recurring.active ? "Pause" : "Resume"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  onClick={() => {
                    deleteRecurring(recurring.id);
                    toast.success("Recurring deleted");
                    onClose();
                  }}
                >
                  Delete recurring
                </Button>
              </>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
