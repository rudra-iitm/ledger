"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AccountSelect } from "@/components/fields/account-select";
import { DateField } from "@/components/fields/date-field";
import { useAppStore } from "@/lib/store/app-store";
import { todayISO } from "@/lib/domain/dates";

export function TransferSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const addTransfer = useAppStore((state) => state.addTransfer);
  const currency = useAppStore((state) => state.data.settings.currency);

  const [amount, setAmount] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState<string | undefined>();
  const [destinationAccountId, setDestinationAccountId] = useState<string | undefined>();
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setSourceAccountId(undefined);
    setDestinationAccountId(undefined);
    setDate(todayISO());
    setError(null);
    setIsSubmitting(false);
  }, [open]);

  const submit = () => {
    if (isSubmitting) return;
    const parsedAmount = Number(amount);
    
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    if (!sourceAccountId || sourceAccountId === "none") {
      setError("Select a source account");
      return;
    }
    if (!destinationAccountId || destinationAccountId === "none") {
      setError("Select a destination account");
      return;
    }
    if (sourceAccountId === destinationAccountId) {
      setError("Source and destination accounts must be different");
      return;
    }

    setIsSubmitting(true);
    try {
      addTransfer(
        sourceAccountId,
        destinationAccountId,
        parsedAmount,
        date,
        "Transfer"
      );
      toast.success("Transfer completed");
      onClose();
    } catch {
      toast.error("Failed to complete transfer");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-5" />
            Transfer Funds
          </SheetTitle>
        </SheetHeader>

        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex items-end justify-center gap-1 rounded-2xl border border-border bg-card py-8 shadow-soft transition-[border-color,box-shadow] duration-200 focus-within:border-ring/60 focus-within:ring-4 focus-within:ring-ring/15">
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
                const next = event.target.value.replace(/[^\d.]/g, "");
                setAmount(next);
                setError(null);
              }}
              className="w-40 bg-transparent text-center text-5xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40"
            />
          </div>

          <div className="flex flex-col gap-4 p-4 rounded-xl border border-border bg-muted/30">
            <div className="flex flex-col gap-2">
              <Label htmlFor="transfer-source">From Account</Label>
              <AccountSelect
                id="transfer-source"
                value={sourceAccountId}
                onChange={setSourceAccountId}
              />
            </div>
            
            <div className="flex justify-center -my-2 relative z-10">
              <div className="bg-background border border-border rounded-full p-2 text-muted-foreground shadow-sm">
                <ArrowRightLeft className="size-4 rotate-90" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="transfer-destination">To Account</Label>
              <AccountSelect
                id="transfer-destination"
                value={destinationAccountId}
                onChange={setDestinationAccountId}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="transfer-date">Date</Label>
            <DateField
              id="transfer-date"
              value={date}
              onChange={(next) => next && setDate(next)}
            />
          </div>

          {error && (
            <p role="alert" className="-mt-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Transfer Funds"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
