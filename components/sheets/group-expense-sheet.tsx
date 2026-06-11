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
import { todayISO } from "@/lib/domain/dates";
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
  const addGroupExpense = useAppStore((state) => state.addGroupExpense);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [splitAmong, setSplitAmong] = useState<string[]>([]);

  useEffect(() => {
    if (open && group) {
      setDescription("");
      setAmount("");
      setPaidBy(group.members[0]?.id ?? "");
      setSplitAmong(group.members.map((member) => member.id));
    }
  }, [open, group]);

  if (!group) return null;

  const parsedAmount = Number(amount);
  const valid =
    description.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    paidBy !== "" &&
    splitAmong.length > 0;

  const toggleMember = (memberId: string) => {
    setSplitAmong((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  };

  const submit = () => {
    if (!valid) return;
    addGroupExpense(group.id, {
      description: description.trim(),
      amount: parsedAmount,
      paidBy,
      splitAmong,
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
          <SheetDescription>Split equally among the selected members.</SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-4"
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

          <div className="grid grid-cols-2 gap-3">
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

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-muted-foreground">
              Split among
            </legend>
            <div className="flex flex-wrap gap-2">
              {group.members.map((member) => {
                const selected = splitAmong.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleMember(member.id)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {member.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button type="submit" size="lg" disabled={!valid} className="mt-2">
            Add expense
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
