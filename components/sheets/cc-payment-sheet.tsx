"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AccountSelect } from "@/components/fields/account-select";
import { DateField } from "@/components/fields/date-field";
import { todayISO } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { remainingStatement } from "@/lib/domain/balances";
import { useAppStore } from "@/lib/store/app-store";

export function CreditCardPaymentSheet({
  open,
  cardId,
  onClose,
}: {
  open: boolean;
  cardId: string | null;
  onClose: () => void;
}) {
  const addCreditCardPayment = useAppStore(
    (state) => state.addCreditCardPayment,
  );
  const currency = useAppStore((state) => state.data.settings.currency);
  const card = useAppStore((state) =>
    state.data.accounts.find((account) => account.id === cardId),
  );
  const expenses = useAppStore((state) => state.data.expenses);

  const [amount, setAmount] = useState("");
  const [fromAccountId, setFromAccountId] = useState<string | undefined>();
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const outstanding = card ? Math.max(0, card.balance) : 0;
  const remaining = useMemo(
    () => (card ? remainingStatement(card, expenses) : 0),
    [card, expenses],
  );

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setFromAccountId(undefined);
    setDate(todayISO());
    setNotes("");
    setError(null);
    setIsSubmitting(false);
  }, [open]);

  if (!card) return null;

  const quickOptions: Array<{ label: string; value: number }> = [];
  if (remaining > 0) quickOptions.push({ label: "Statement due", value: remaining });
  if (card.minimumDue) quickOptions.push({ label: "Minimum due", value: card.minimumDue });
  if (outstanding > 0) quickOptions.push({ label: "Full outstanding", value: outstanding });

  const submit = () => {
    if (isSubmitting) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    if (!fromAccountId || fromAccountId === "none") {
      setError("Select a payment account");
      return;
    }
    if (fromAccountId === card.id) {
      setError("Payment account must differ from the card");
      return;
    }
    setIsSubmitting(true);
    try {
      addCreditCardPayment({
        cardId: card.id,
        fromAccountId,
        amount: parsedAmount,
        date,
        notes,
      });
      toast.success("Payment recorded");
      onClose();
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader className="mb-2">
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="size-5" />
            Pay {card.name}
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
              <p className="text-[12px] text-muted-foreground">Outstanding</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {formatMoney(outstanding, currency)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
              <p className="text-[12px] text-muted-foreground">Statement due</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {formatMoney(remaining, currency)}
              </p>
            </div>
          </div>

          <div className="flex items-end justify-center gap-1 rounded-2xl border border-border bg-card py-6 shadow-soft transition-[border-color,box-shadow] duration-200 focus-within:border-ring/60 focus-within:ring-4 focus-within:ring-ring/15">
            <span className="pb-1 text-2xl font-medium text-muted-foreground">
              {currency}
            </span>
            <input
              aria-label="Amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value.replace(/[^\d.]/g, ""));
                setError(null);
              }}
              className="w-40 bg-transparent text-center text-5xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40"
            />
          </div>

          {quickOptions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quickOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    setAmount(String(option.value));
                    setError(null);
                  }}
                  className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-medium outline-none transition-colors hover:bg-accent active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {option.label} · {formatMoney(option.value, currency)}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="cc-payment-account">Pay from</Label>
            <AccountSelect
              id="cc-payment-account"
              value={fromAccountId}
              onChange={setFromAccountId}
              allowNone={false}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cc-payment-date">Date</Label>
            <DateField
              id="cc-payment-date"
              value={date}
              onChange={(next) => next && setDate(next)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cc-payment-notes">Notes</Label>
            <Textarea
              id="cc-payment-notes"
              placeholder="Add a note"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="-mt-1 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Recording..." : "Record payment"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
