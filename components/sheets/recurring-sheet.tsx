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
import { AccountSelect } from "@/components/fields/account-select";
import {
  CATEGORIES,
  RECURRENCE_FREQUENCIES,
  categorySchema,
  recurrenceFrequencySchema,
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

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<RecurringExpense["category"]>("Bills");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [weekday, setWeekday] = useState("1");
  const [startDate, setStartDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (recurring) {
      setDescription(recurring.description);
      setAmount(String(recurring.amount));
      setCategory(recurring.category);
      setFrequency(recurring.frequency);
      setDayOfMonth(String(recurring.dayOfMonth));
      setWeekday(String(recurring.weekday ?? weekdayOf(recurring.startDate)));
      setStartDate(recurring.startDate);
      setAccountId(recurring.accountId);
    } else {
      setDescription("");
      setAmount("");
      setCategory("Bills");
      setFrequency("monthly");
      setDayOfMonth("1");
      setWeekday("1");
      setStartDate(todayISO());
      setAccountId(undefined);
    }
    setError(null);
  }, [open, recurring]);

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

    const payload = {
      description: description.trim(),
      amount: parsedAmount,
      category,
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

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{recurring ? "Edit recurring" : "Add recurring"}</SheetTitle>
          <SheetDescription>
            Added to your expenses automatically when due.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="recurring-description">Description</Label>
            <Input
              id="recurring-description"
              placeholder="Rent"
              autoComplete="off"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="recurring-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(categorySchema.parse(value))}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="recurring-start">Starts</Label>
              <Input
                id="recurring-start"
                type="date"
                value={startDate}
                onChange={(event) =>
                  event.target.value && setStartDate(event.target.value)
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="recurring-account">Paid via</Label>
              <AccountSelect
                id="recurring-account"
                value={accountId}
                onChange={setAccountId}
              />
            </div>
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
