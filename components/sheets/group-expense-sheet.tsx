"use client";

import { useEffect, useMemo, useState } from "react";
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
import { todayISO } from "@/lib/domain/dates";
import { toMinorUnits } from "@/lib/domain/money";
import {
  splitTypeSchema,
  type SplitShare,
  type SplitType,
} from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function GroupExpenseSheet({
  open,
  groupId,
  onClose,
}: {
  open: boolean;
  groupId: string | null;
  onClose: () => void;
}) {
  const group = useAppStore((state) =>
    state.data.groups.find((item) => item.id === groupId),
  );
  const currency = useAppStore((state) => state.data.settings.currency);
  const addGroupExpense = useAppStore((state) => state.addGroupExpense);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [splitAmong, setSplitAmong] = useState<string[]>([]);
  const [shareValues, setShareValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && group) {
      setDescription("");
      setAmount("");
      setPaidBy(group.members[0]?.id ?? "");
      setSplitType("equal");
      setSplitAmong(group.members.map((member) => member.id));
      setShareValues({});
    }
  }, [open, group]);

  const parsedAmount = Number(amount);

  const shareTotals = useMemo(() => {
    const sum = splitAmong.reduce(
      (total, id) => total + (Number(shareValues[id]) || 0),
      0,
    );
    return sum;
  }, [splitAmong, shareValues]);

  if (!group) return null;

  const toggleMember = (memberId: string) => {
    setSplitAmong((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  };

  const baseValid =
    description.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    paidBy !== "" &&
    splitAmong.length > 0;

  const splitValid =
    splitType === "equal"
      ? true
      : splitType === "percentage"
        ? Math.abs(shareTotals - 100) < 0.01
        : toMinorUnits(shareTotals) === toMinorUnits(parsedAmount);

  const valid = baseValid && splitValid;

  const submit = () => {
    if (!valid) return;
    const shares: SplitShare[] =
      splitType === "equal"
        ? []
        : splitAmong.map((id) => ({
            memberId: id,
            value: Number(shareValues[id]) || 0,
          }));

    addGroupExpense(group.id, {
      description: description.trim(),
      amount: parsedAmount,
      paidBy,
      splitType,
      splitAmong,
      shares,
      date: todayISO(),
    });
    toast.success("Expense added to group");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add to {group.name}</SheetTitle>
          <SheetDescription>Choose how to split this expense.</SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-expense-description">Description</Label>
            <Input
              id="group-expense-description"
              placeholder="Dinner"
              autoComplete="off"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="group-expense-amount">Amount</Label>
              <Input
                id="group-expense-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="1200"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="group-expense-paid-by">Paid by</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger id="group-expense-paid-by">
                  <SelectValue placeholder="Member" />
                </SelectTrigger>
                <SelectContent>
                  {group.members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Split</Label>
            <Tabs
              value={splitType}
              onValueChange={(value) => setSplitType(splitTypeSchema.parse(value))}
            >
              <TabsList className="w-full">
                <TabsTrigger value="equal">Equal</TabsTrigger>
                <TabsTrigger value="unequal">Unequal</TabsTrigger>
                <TabsTrigger value="percentage">Percent</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Members</legend>
            {group.members.map((member) => {
              const selected = splitAmong.includes(member.id);
              return (
                <div key={member.id} className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleMember(member.id)}
                    className={cn(
                      "flex h-10 flex-1 items-center rounded-xl border px-3.5 text-left text-[15px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-ring bg-card"
                        : "border-border bg-transparent text-muted-foreground",
                    )}
                  >
                    {member.name}
                  </button>
                  {selected && splitType !== "equal" && (
                    <div className="flex w-28 items-center gap-1.5">
                      {splitType === "unequal" && (
                        <span className="text-sm text-muted-foreground">
                          {currency}
                        </span>
                      )}
                      <Input
                        aria-label={`${member.name} share`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={shareValues[member.id] ?? ""}
                        onChange={(event) =>
                          setShareValues((current) => ({
                            ...current,
                            [member.id]: event.target.value,
                          }))
                        }
                        className="h-9"
                      />
                      {splitType === "percentage" && (
                        <span className="text-sm text-muted-foreground">%</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>

          {splitType !== "equal" && splitAmong.length > 0 && (
            <p
              className={cn(
                "text-sm",
                splitValid ? "text-muted-foreground" : "text-destructive",
              )}
            >
              {splitType === "percentage"
                ? `Total ${shareTotals}% of 100%`
                : `Total ${currency}${shareTotals.toFixed(2)} of ${currency}${
                    Number.isFinite(parsedAmount) ? parsedAmount.toFixed(2) : "0"
                  }`}
            </p>
          )}

          <Button type="submit" size="lg" disabled={!valid} className="mt-1">
            Add expense
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
