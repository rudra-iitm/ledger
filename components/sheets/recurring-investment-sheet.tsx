"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AccountSelect } from "@/components/fields/account-select";
import { AffectBalanceToggle } from "@/components/fields/affect-balance-toggle";
import { DateField } from "@/components/fields/date-field";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  ASSET_UNIT_LABELS,
  INVESTMENT_FREQUENCIES,
  assetTypeSchema,
  investmentFrequencySchema,
  type AssetType,
  type InvestmentFrequency,
  type RecurringInvestment,
} from "@/lib/domain/types";
import { todayISO } from "@/lib/domain/dates";
import { useAppStore } from "@/lib/store/app-store";

const NEW_ASSET = "__new__";

const FREQUENCY_LABELS: Record<InvestmentFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function RecurringInvestmentSheet({
  open,
  recurring,
  onClose,
}: {
  open: boolean;
  recurring?: RecurringInvestment;
  onClose: () => void;
}) {
  const accounts = useAppStore((state) => state.data.accounts);
  const addAccount = useAppStore((state) => state.addAccount);
  const addRecurringInvestment = useAppStore(
    (state) => state.addRecurringInvestment,
  );
  const updateRecurringInvestment = useAppStore(
    (state) => state.updateRecurringInvestment,
  );
  const deleteRecurringInvestment = useAppStore(
    (state) => state.deleteRecurringInvestment,
  );
  const currency = useAppStore((state) => state.data.settings.currency);

  const investmentAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.type === "investment" && !account.archived,
      ),
    [accounts],
  );

  const [target, setTarget] = useState<string>(NEW_ASSET);
  const [assetType, setAssetType] = useState<AssetType>("gold");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [units, setUnits] = useState("");
  const [fromAccountId, setFromAccountId] = useState<string | undefined>();
  const [frequency, setFrequency] = useState<InvestmentFrequency>("daily");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [startDate, setStartDate] = useState(todayISO());
  const [affectsBalance, setAffectsBalance] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (recurring) {
      setTarget(recurring.investmentAccountId);
      setAssetType(recurring.assetType);
      setName(recurring.name);
      setAmount(String(recurring.amount));
      setUnits(recurring.units !== undefined ? String(recurring.units) : "");
      setFromAccountId(recurring.fromAccountId);
      setFrequency(recurring.frequency);
      setDayOfMonth(String(recurring.dayOfMonth));
      setStartDate(recurring.startDate);
      setAffectsBalance(recurring.affectsBalance ?? true);
    } else {
      setTarget(investmentAccounts[0]?.id ?? NEW_ASSET);
      setAssetType("gold");
      setName("");
      setAmount("");
      setUnits("");
      setFromAccountId(undefined);
      setFrequency("daily");
      setDayOfMonth("1");
      setStartDate(todayISO());
      setAffectsBalance(true);
    }
    setError(null);
    setIsSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recurring]);

  const isNew = target === NEW_ASSET;
  const showDayOfMonth = frequency === "monthly" || frequency === "quarterly";

  const submit = () => {
    if (isSubmitting) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    if (!fromAccountId || fromAccountId === "none") {
      setError("Select the funding account");
      return;
    }
    if (isNew && !name.trim()) {
      setError("Name the asset");
      return;
    }

    setIsSubmitting(true);
    try {
      let investmentAccountId = target;
      let resolvedName = name.trim();
      if (isNew) {
        investmentAccountId = addAccount({
          name: resolvedName,
          type: "investment",
          balance: 0,
          openingBalance: 0,
          icon: "📈",
          archived: false,
          debitCards: [],
          assetType,
          unitLabel: ASSET_UNIT_LABELS[assetType],
        });
      } else if (!resolvedName) {
        resolvedName =
          investmentAccounts.find((a) => a.id === target)?.name ?? "Investment";
      }
      const payload = {
        name: resolvedName,
        assetType,
        amount: parsedAmount,
        units: units ? Number(units) : undefined,
        fromAccountId,
        investmentAccountId,
        frequency,
        dayOfMonth: Number(dayOfMonth) || 1,
        startDate,
        affectsBalance,
        active: true,
      };
      if (recurring) {
        updateRecurringInvestment(recurring.id, payload);
        toast.success("Schedule updated");
      } else {
        addRecurringInvestment(payload);
        toast.success("Recurring investment created");
      }
      onClose();
    } catch {
      toast.error("Failed to save schedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CalendarClock className="size-5" />
            {recurring ? "Edit schedule" : "Recurring investment"}
          </SheetTitle>
        </SheetHeader>

        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="rec-investment-asset">Asset</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="rec-investment-asset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {investmentAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_ASSET}>＋ New asset…</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isNew && (
            <div className="grid grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rec-investment-type">Type</Label>
                <Select
                  value={assetType}
                  onValueChange={(value) =>
                    setAssetType(assetTypeSchema.parse(value))
                  }
                >
                  <SelectTrigger id="rec-investment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {ASSET_TYPE_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rec-investment-name">Name</Label>
                <Input
                  id="rec-investment-name"
                  placeholder="e.g. Daily Silver"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rec-investment-freq">Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(value) =>
                  setFrequency(investmentFrequencySchema.parse(value))
                }
              >
                <SelectTrigger id="rec-investment-freq">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVESTMENT_FREQUENCIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {FREQUENCY_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showDayOfMonth ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="rec-investment-dom">Day of month</Label>
                <Input
                  id="rec-investment-dom"
                  inputMode="numeric"
                  value={dayOfMonth}
                  onChange={(event) =>
                    setDayOfMonth(
                      event.target.value.replace(/[^\d]/g, "").slice(0, 2),
                    )
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="rec-investment-units">Units</Label>
                <Input
                  id="rec-investment-units"
                  inputMode="decimal"
                  placeholder="optional"
                  value={units}
                  onChange={(event) =>
                    setUnits(event.target.value.replace(/[^\d.]/g, ""))
                  }
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rec-investment-from">Funding account</Label>
            <AccountSelect
              id="rec-investment-from"
              value={fromAccountId}
              onChange={setFromAccountId}
              allowNone={false}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rec-investment-start">Starts</Label>
            <DateField
              id="rec-investment-start"
              value={startDate}
              onChange={(next) => next && setStartDate(next)}
            />
          </div>

          <AffectBalanceToggle
            checked={affectsBalance}
            onChange={setAffectsBalance}
            title="Deduct from funding account"
            description="Turn off to accumulate gold bought outside the app"
          />

          {error && (
            <p role="alert" className="-mt-1 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : recurring
                  ? "Save changes"
                  : "Create schedule"}
            </Button>
            {recurring && (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                disabled={isSubmitting}
                onClick={() => {
                  deleteRecurringInvestment(recurring.id);
                  toast.success("Schedule deleted");
                  onClose();
                }}
              >
                Delete schedule
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
