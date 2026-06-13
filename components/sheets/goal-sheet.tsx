"use client";

import { useEffect, useState } from "react";
import { Target } from "lucide-react";
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
import { DateField } from "@/components/fields/date-field";
import {
  GOAL_TYPES,
  goalTypeSchema,
  type Goal,
  type GoalType,
} from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  gold: "Gold",
  silver: "Silver",
  emergency: "Emergency fund",
  house: "House fund",
  retirement: "Retirement",
  education: "Education",
  travel: "Travel",
  custom: "Custom",
};

const GOAL_TYPE_ICONS: Record<GoalType, string> = {
  gold: "🥇",
  silver: "🥈",
  emergency: "🛟",
  house: "🏠",
  retirement: "🌴",
  education: "🎓",
  travel: "✈️",
  custom: "🎯",
};

export function GoalSheet({
  open,
  goal,
  onClose,
}: {
  open: boolean;
  goal?: Goal;
  onClose: () => void;
}) {
  const accounts = useAppStore((state) => state.data.accounts);
  const addGoal = useAppStore((state) => state.addGoal);
  const updateGoal = useAppStore((state) => state.updateGoal);
  const deleteGoal = useAppStore((state) => state.deleteGoal);
  const currency = useAppStore((state) => state.data.settings.currency);

  const trackable = accounts.filter((account) => !account.archived);

  const [name, setName] = useState("");
  const [type, setType] = useState<GoalType>("emergency");
  const [target, setTarget] = useState("");
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (goal) {
      setName(goal.name);
      setType(goal.type);
      setTarget(String(goal.targetAmount));
      setAccountIds(goal.accountIds);
      setTargetDate(goal.targetDate ?? "");
    } else {
      setName("");
      setType("emergency");
      setTarget("");
      setAccountIds([]);
      setTargetDate("");
    }
    setError(null);
  }, [open, goal]);

  const toggleAccount = (id: string) =>
    setAccountIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );

  const submit = () => {
    if (!name.trim()) {
      setError("Name the goal");
      return;
    }
    const parsedTarget = Number(target);
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setError("Enter a target greater than zero");
      return;
    }
    const payload = {
      name: name.trim(),
      type,
      targetAmount: parsedTarget,
      accountIds,
      targetDate: targetDate || undefined,
      icon: GOAL_TYPE_ICONS[type],
    };
    if (goal) {
      updateGoal(goal.id, payload);
      toast.success("Goal updated");
    } else {
      addGoal(payload);
      toast.success("Goal created");
    }
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Target className="size-5" />
            {goal ? "Edit goal" : "New goal"}
          </SheetTitle>
        </SheetHeader>

        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-type">Type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(goalTypeSchema.parse(value))}
              >
                <SelectTrigger id="goal-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {GOAL_TYPE_ICONS[item]} {GOAL_TYPE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-target">Target</Label>
              <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3.5">
                <span className="text-muted-foreground">{currency}</span>
                <input
                  id="goal-target"
                  inputMode="decimal"
                  placeholder="0"
                  value={target}
                  onChange={(event) =>
                    setTarget(event.target.value.replace(/[^\d.]/g, ""))
                  }
                  className="h-10 w-full bg-transparent text-base outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              placeholder="e.g. 100g gold by Diwali"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Track these accounts</Label>
            <div className="flex flex-wrap gap-2">
              {trackable.map((account) => {
                const selected = accountIds.includes(account.id);
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => toggleAccount(account.id)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[13px] font-medium outline-none transition-colors active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {account.icon} {account.name}
                  </button>
                );
              })}
            </div>
            <p className="text-[12px] text-muted-foreground">
              Progress is the combined balance of the chosen accounts.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-date">Target date</Label>
            <DateField
              id="goal-date"
              value={targetDate || null}
              onChange={(next) => setTargetDate(next)}
            />
          </div>

          {error && (
            <p role="alert" className="-mt-1 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" size="lg">
              {goal ? "Save changes" : "Create goal"}
            </Button>
            {goal && (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                onClick={() => {
                  deleteGoal(goal.id);
                  toast.success("Goal deleted");
                  onClose();
                }}
              >
                Delete goal
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
