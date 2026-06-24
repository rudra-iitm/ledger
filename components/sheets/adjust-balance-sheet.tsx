"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DateField } from "@/components/fields/date-field";
import { todayISO } from "@/lib/domain/dates";
import { formatMoney, roundMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function AdjustBalanceSheet({
  open,
  accountId,
  onClose,
}: {
  open: boolean;
  accountId: string | null;
  onClose: () => void;
}) {
  const adjustBalance = useAppStore((state) => state.adjustBalance);
  const currency = useAppStore((state) => state.data.settings.currency);
  const account = useAppStore((state) =>
    state.data.accounts.find((item) => item.id === accountId),
  );

  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayISO());
  const [hardReset, setHardReset] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue("");
    setDate(todayISO());
    setHardReset(false);
    setError(null);
  }, [open]);

  if (!account) return null;

  const isCard = account.type === "credit_card";
  const supportsAdjustment = !isCard && account.type !== "investment";
  const currentBalance = account.balance;
  const parsed = Number(value);
  const hasValue = value !== "" && Number.isFinite(parsed);
  const difference = hasValue ? roundMoney(parsed - currentBalance) : 0;
  // Card/investment accounts always overwrite via opening balance.
  const overwrites = hardReset || !supportsAdjustment;

  const submit = () => {
    if (!hasValue) {
      setError("Enter the new balance");
      return;
    }
    if (difference === 0) {
      toast.success("Balance already matches");
      onClose();
      return;
    }
    adjustBalance(account.id, parsed, date, hardReset);
    toast.success(overwrites ? "Balance reset" : "Balance adjusted");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Pencil className="size-5" />
            Adjust {account.name}
          </SheetTitle>
          <SheetDescription>
            Set the current balance. A correction is recorded so reports stay
            accurate.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
              <p className="text-[12px] text-muted-foreground">
                Current {isCard ? "outstanding" : "balance"}
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {formatMoney(currentBalance, currency)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
              <p className="text-[12px] text-muted-foreground">Difference</p>
              <p
                className={cn(
                  "mt-0.5 text-lg font-semibold tabular-nums",
                  hasValue && difference !== 0
                    ? difference > 0
                      ? "text-emerald-500"
                      : "text-destructive"
                    : "",
                )}
              >
                {hasValue
                  ? `${difference > 0 ? "+" : ""}${formatMoney(difference, currency)}`
                  : "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="adjust-balance-value">
                New balance {isCard ? "(outstanding)" : ""}
              </Label>
              <button
                type="button"
                onClick={() => {
                  setValue("0");
                  setHardReset(true);
                  setError(null);
                }}
                className="rounded-lg text-[12px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                Reset to {currency}0
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3.5">
              <span className="text-muted-foreground">{currency}</span>
              <input
                id="adjust-balance-value"
                inputMode="decimal"
                placeholder="0"
                autoFocus
                value={value}
                onChange={(event) => {
                  setValue(event.target.value.replace(/[^\d.-]/g, ""));
                  setError(null);
                }}
                className="h-10 w-full bg-transparent text-base outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="adjust-balance-date">Date</Label>
            <DateField
              id="adjust-balance-date"
              value={date}
              onChange={(next) => next && setDate(next)}
            />
          </div>

          {supportsAdjustment && (
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
              <div className="flex flex-col pr-3">
                <span className="text-[15px] font-medium">Hard reset</span>
                <span className="text-[13px] text-muted-foreground">
                  Overwrite the balance without adding a transaction entry
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={hardReset}
                aria-label="Hard reset"
                onClick={() => setHardReset((current) => !current)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  hardReset ? "bg-destructive" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none block size-5 rounded-full bg-background shadow-sm transition-transform",
                    hardReset ? "translate-x-[22px]" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
          )}

          {hasValue && difference !== 0 && (
            <p className="px-1 text-[12px] text-muted-foreground">
              {overwrites
                ? "The balance is overwritten directly — no transaction is added."
                : `A ${difference > 0 ? "income" : "expense"} of ${formatMoney(
                    Math.abs(difference),
                    currency,
                  )} will be posted to match.`}
            </p>
          )}

          {error && (
            <p role="alert" className="-mt-1 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            variant={overwrites ? "destructive" : "default"}
          >
            {overwrites ? "Reset balance" : "Save balance"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
