"use client";

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DateField } from "@/components/fields/date-field";
import { todayISO } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function ReconcileSheet({
  open,
  accountId,
  onClose,
}: {
  open: boolean;
  accountId: string | null;
  onClose: () => void;
}) {
  const reconcileAccount = useAppStore((state) => state.reconcileAccount);
  const currency = useAppStore((state) => state.data.settings.currency);
  const account = useAppStore((state) =>
    state.data.accounts.find((item) => item.id === accountId),
  );

  const [actual, setActual] = useState("");
  const [date, setDate] = useState(todayISO());
  const [postAdjustment, setPostAdjustment] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setActual("");
    setDate(todayISO());
    setPostAdjustment(true);
    setError(null);
  }, [open]);

  if (!account) return null;

  const appBalance = account.balance;
  const parsed = Number(actual);
  const hasValue = actual !== "" && Number.isFinite(parsed);
  const difference = hasValue ? Math.round((parsed - appBalance) * 100) / 100 : 0;
  const isCard = account.type === "credit_card";

  const submit = () => {
    if (!hasValue) {
      setError("Enter the actual balance");
      return;
    }
    reconcileAccount(account.id, parsed, date, postAdjustment && !isCard);
    toast.success(
      difference === 0 ? "Account reconciled" : "Reconciliation saved",
    );
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Scale className="size-5" />
            Reconcile {account.name}
          </SheetTitle>
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
              <p className="text-[12px] text-muted-foreground">App balance</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {formatMoney(
                  isCard ? -Math.max(0, appBalance) : appBalance,
                  currency,
                )}
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
            <Label htmlFor="reconcile-actual">
              Actual balance {isCard ? "(outstanding)" : ""}
            </Label>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3.5">
              <span className="text-muted-foreground">{currency}</span>
              <input
                id="reconcile-actual"
                inputMode="decimal"
                placeholder="0"
                value={actual}
                onChange={(event) => {
                  setActual(event.target.value.replace(/[^\d.-]/g, ""));
                  setError(null);
                }}
                className="h-10 w-full bg-transparent text-base outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reconcile-date">Date</Label>
            <DateField
              id="reconcile-date"
              value={date}
              onChange={(next) => next && setDate(next)}
            />
          </div>

          {!isCard && (
            <div className="flex flex-col gap-1.5">
              <AffectBalanceToggleLabel
                checked={postAdjustment}
                onChange={setPostAdjustment}
              />
              {postAdjustment && hasValue && difference !== 0 && (
                <p className="px-1 text-[12px] text-muted-foreground">
                  A {difference > 0 ? "income" : "expense"} of{" "}
                  {formatMoney(Math.abs(difference), currency)} will be posted to
                  match.
                </p>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="-mt-1 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" size="lg">
              Reconcile
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function AffectBalanceToggleLabel({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
      <div className="flex flex-col">
        <span className="text-[15px] font-medium">Post adjustment</span>
        <span className="text-[13px] text-muted-foreground">
          Add a transaction so the app matches reality
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Post adjustment"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          checked ? "bg-emerald-500" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "pointer-events-none block size-5 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
