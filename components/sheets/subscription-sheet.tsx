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
import { Textarea } from "@/components/ui/textarea";
import { AccountSelect } from "@/components/fields/account-select";
import { DateField } from "@/components/fields/date-field";
import {
  BILLING_CYCLES,
  CATEGORIES,
  billingCycleSchema,
  categorySchema,
  type BillingCycle,
  type Subscription,
} from "@/lib/domain/types";
import { todayISO } from "@/lib/domain/dates";
import { useAppStore } from "@/lib/store/app-store";

export const BILLING_LABELS: Record<BillingCycle, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function SubscriptionSheet({
  open,
  subscription,
  onClose,
}: {
  open: boolean;
  subscription?: Subscription;
  onClose: () => void;
}) {
  const addSubscription = useAppStore((state) => state.addSubscription);
  const updateSubscription = useAppStore((state) => state.updateSubscription);
  const deleteSubscription = useAppStore((state) => state.deleteSubscription);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [category, setCategory] = useState<Subscription["category"]>("Bills");
  const [nextRenewalDate, setNextRenewalDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<string | undefined>();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (subscription) {
      setName(subscription.name);
      setAmount(String(subscription.amount));
      setBillingCycle(subscription.billingCycle);
      setCategory(subscription.category);
      setNextRenewalDate(subscription.nextRenewalDate);
      setAccountId(subscription.accountId);
      setNotes(subscription.notes ?? "");
    } else {
      setName("");
      setAmount("");
      setBillingCycle("monthly");
      setCategory("Bills");
      setNextRenewalDate(todayISO());
      setAccountId(undefined);
      setNotes("");
    }
    setError(null);
  }, [open, subscription]);

  const submit = () => {
    const parsedAmount = Number(amount);
    if (!name.trim()) {
      setError("Add a name");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    const payload = {
      name: name.trim(),
      amount: parsedAmount,
      billingCycle,
      category,
      nextRenewalDate,
      accountId,
      notes: notes.trim() || undefined,
    };
    if (subscription) {
      updateSubscription(subscription.id, payload);
      toast.success("Subscription updated");
    } else {
      addSubscription({ ...payload, active: true });
      toast.success("Subscription added");
    }
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {subscription ? "Edit subscription" : "New subscription"}
          </SheetTitle>
          <SheetDescription>
            Renewals are added to your expenses automatically.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="subscription-name">Name</Label>
            <Input
              id="subscription-name"
              placeholder="Netflix"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="subscription-amount">Amount</Label>
              <Input
                id="subscription-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="199"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="subscription-cycle">Billing cycle</Label>
              <Select
                value={billingCycle}
                onValueChange={(value) =>
                  setBillingCycle(billingCycleSchema.parse(value))
                }
              >
                <SelectTrigger id="subscription-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {BILLING_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="subscription-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(categorySchema.parse(value))}
              >
                <SelectTrigger id="subscription-category">
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="subscription-renewal">Next renewal</Label>
              <DateField
                id="subscription-renewal"
                value={nextRenewalDate}
                onChange={(next) => next && setNextRenewalDate(next)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="subscription-account">Account</Label>
            <AccountSelect
              id="subscription-account"
              value={accountId}
              onChange={setAccountId}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="subscription-notes">Notes (optional)</Label>
            <Textarea
              id="subscription-notes"
              placeholder="Shared family plan"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-1 flex flex-col gap-2">
            <Button type="submit" size="lg">
              {subscription ? "Save changes" : "Add subscription"}
            </Button>
            {subscription && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    updateSubscription(subscription.id, {
                      active: !subscription.active,
                    });
                    toast.success(
                      subscription.active
                        ? "Subscription paused"
                        : "Subscription resumed",
                    );
                    onClose();
                  }}
                >
                  {subscription.active ? "Pause" : "Resume"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  onClick={() => {
                    deleteSubscription(subscription.id);
                    toast.success("Subscription cancelled");
                    onClose();
                  }}
                >
                  Cancel subscription
                </Button>
              </>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
