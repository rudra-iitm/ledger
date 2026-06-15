"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { AccountSelect } from "@/components/fields/account-select";
import { AffectBalanceToggle } from "@/components/fields/affect-balance-toggle";
import { DateField } from "@/components/fields/date-field";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  ASSET_UNIT_LABELS,
  assetTypeSchema,
  type AssetType,
} from "@/lib/domain/types";
import { assetNeedsPriceId, priceIdHint } from "@/lib/domain/prices";
import { todayISO } from "@/lib/domain/dates";
import { useAppStore } from "@/lib/store/app-store";

const NEW_ASSET = "__new__";

export function InvestmentSheet({
  open,
  defaultInvestmentAccountId,
  onClose,
}: {
  open: boolean;
  defaultInvestmentAccountId?: string;
  onClose: () => void;
}) {
  const accounts = useAppStore((state) => state.data.accounts);
  const addAccount = useAppStore((state) => state.addAccount);
  const addInvestment = useAppStore((state) => state.addInvestment);
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
  const [assetName, setAssetName] = useState("");
  const [priceId, setPriceId] = useState("");
  const [amount, setAmount] = useState("");
  const [units, setUnits] = useState("");
  const [fromAccountId, setFromAccountId] = useState<string | undefined>();
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [affectsBalance, setAffectsBalance] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial =
      defaultInvestmentAccountId ?? investmentAccounts[0]?.id ?? NEW_ASSET;
    setTarget(initial);
    setAssetType("gold");
    setAssetName("");
    setPriceId("");
    setAmount("");
    setUnits("");
    setFromAccountId(undefined);
    setDate(todayISO());
    setNotes("");
    setAffectsBalance(true);
    setError(null);
    setIsSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultInvestmentAccountId]);

  const isNew = target === NEW_ASSET;
  const unitLabel = isNew
    ? ASSET_UNIT_LABELS[assetType]
    : investmentAccounts.find((a) => a.id === target)?.unitLabel ?? "units";

  const submit = () => {
    if (isSubmitting) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    if (!fromAccountId || fromAccountId === "none") {
      setError("Select the account you paid from");
      return;
    }
    if (isNew && !assetName.trim()) {
      setError("Name the asset");
      return;
    }
    const parsedUnits = units ? Number(units) : undefined;
    if (parsedUnits !== undefined && (!Number.isFinite(parsedUnits) || parsedUnits < 0)) {
      setError("Units must be zero or more");
      return;
    }

    setIsSubmitting(true);
    try {
      let investmentAccountId = target;
      let name: string;
      if (isNew) {
        name = assetName.trim();
        investmentAccountId = addAccount({
          name,
          type: "investment",
          balance: 0,
          openingBalance: 0,
          icon: "📈",
          archived: false,
          debitCards: [],
          assetType,
          unitLabel: ASSET_UNIT_LABELS[assetType],
          priceId:
            assetNeedsPriceId(assetType) && priceId.trim()
              ? priceId.trim()
              : undefined,
        });
      } else {
        name =
          investmentAccounts.find((a) => a.id === target)?.name ?? "Investment";
      }
      addInvestment({
        name,
        fromAccountId,
        investmentAccountId,
        amount: parsedAmount,
        units: parsedUnits,
        date,
        notes,
        affectsBalance,
      });
      toast.success("Investment recorded");
      onClose();
    } catch {
      toast.error("Failed to record investment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" />
            Add investment
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
            <Label htmlFor="investment-asset">Asset</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="investment-asset">
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
                <Label htmlFor="investment-type">Type</Label>
                <Select
                  value={assetType}
                  onValueChange={(value) =>
                    setAssetType(assetTypeSchema.parse(value))
                  }
                >
                  <SelectTrigger id="investment-type">
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
                <Label htmlFor="investment-name">Name</Label>
                <Input
                  id="investment-name"
                  placeholder="e.g. Digital Gold"
                  value={assetName}
                  onChange={(event) => setAssetName(event.target.value)}
                />
              </div>
              {assetNeedsPriceId(assetType) && (
                <div className="col-span-2 flex flex-col gap-2">
                  <Label htmlFor="investment-price-id">
                    Price reference{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional · for live value)
                    </span>
                  </Label>
                  <Input
                    id="investment-price-id"
                    placeholder={priceIdHint(assetType)}
                    autoComplete="off"
                    value={priceId}
                    onChange={(event) => setPriceId(event.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="investment-units">Units ({unitLabel})</Label>
              <Input
                id="investment-units"
                inputMode="decimal"
                placeholder="optional"
                value={units}
                onChange={(event) =>
                  setUnits(event.target.value.replace(/[^\d.]/g, ""))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="investment-date">Date</Label>
              <DateField
                id="investment-date"
                value={date}
                onChange={(next) => next && setDate(next)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="investment-from">Paid from</Label>
            <AccountSelect
              id="investment-from"
              value={fromAccountId}
              onChange={setFromAccountId}
              allowNone={false}
            />
          </div>

          <AffectBalanceToggle
            checked={affectsBalance}
            onChange={setAffectsBalance}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="investment-notes">Notes</Label>
            <Textarea
              id="investment-notes"
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
              {isSubmitting ? "Saving..." : "Add investment"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
