"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
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
import { AttachmentManager } from "@/components/fields/attachment-manager";
import { DateField } from "@/components/fields/date-field";
import {
  INCOME_CATEGORIES,
  incomeCategorySchema,
  type Expense,
  type IncomeCategory,
} from "@/lib/domain/types";
import { todayISO } from "@/lib/domain/dates";
import { useAppStore } from "@/lib/store/app-store";

export function IncomeSheet({
  open,
  income,
  onClose,
}: {
  open: boolean;
  income?: Expense;
  onClose: () => void;
}) {
  const addIncome = useAppStore((state) => state.addIncome);
  const updateExpense = useAppStore((state) => state.updateExpense);
  const deleteExpense = useAppStore((state) => state.deleteExpense);
  const addAttachment = useAppStore((state) => state.addAttachment);
  const currency = useAppStore((state) => state.data.settings.currency);
  const liveIncome = useAppStore((state) =>
    income ? state.data.expenses.find((item) => item.id === income.id) : undefined,
  );

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<IncomeCategory>("Salary");
  const [source, setSource] = useState("");
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<string | undefined>();
  const [notes, setNotes] = useState("");
  const [affectsBalance, setAffectsBalance] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (income) {
      setAmount(String(income.amount));
      setCategory(income.incomeCategory ?? "Salary");
      setSource(income.source ?? "");
      setDate(income.date);
      setAccountId(income.accountId);
      setNotes(income.notes ?? "");
      setAffectsBalance(income.affectsBalance ?? true);
    } else {
      setAmount("");
      setCategory("Salary");
      setSource("");
      setDate(todayISO());
      setAccountId(undefined);
      setNotes("");
      setAffectsBalance(true);
      setPendingFiles([]);
    }
    setError(null);
    setIsSubmitting(false);
  }, [open, income]);

  const submit = async () => {
    if (isSubmitting) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    const description = source.trim() || category;
    const payload = {
      description,
      amount: parsedAmount,
      category: "Other" as const,
      incomeCategory: category,
      source: source.trim() || undefined,
      date,
      accountId,
      affectsBalance,
      notes: notes.trim() || undefined,
    };

    setIsSubmitting(true);
    try {
      if (income) {
        updateExpense(income.id, payload);
        toast.success("Income updated");
      } else {
        const id = addIncome(payload);
        if (pendingFiles.length > 0) {
          for (const file of pendingFiles) {
            if (file.size > 50 * 1024 * 1024) {
              toast.error(`${file.name} is larger than 50 MB and was skipped`);
              continue;
            }
            await addAttachment(id, file);
          }
        }
        toast.success("Income added");
      }
      onClose();
    } catch {
      toast.error("Failed to save income or upload attachments");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDelete = () => {
    if (!income) return;
    deleteExpense(income.id);
    toast.success("Income deleted");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{income ? "Edit income" : "Add income"}</SheetTitle>
        </SheetHeader>

        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="flex items-end justify-center gap-1 rounded-2xl border border-emerald-500/30 bg-card py-6 shadow-soft transition-[border-color,box-shadow] duration-200 focus-within:border-emerald-500/60 focus-within:ring-4 focus-within:ring-emerald-500/15">
            <span className="pb-1 text-2xl font-medium text-emerald-500/80">
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
              className="w-40 bg-transparent text-center text-5xl font-semibold tracking-tight tabular-nums text-emerald-500 outline-none placeholder:text-muted-foreground/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="income-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) =>
                  setCategory(incomeCategorySchema.parse(value))
                }
              >
                <SelectTrigger id="income-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCOME_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="income-date">Date</Label>
              <DateField
                id="income-date"
                value={date}
                onChange={(next) => next && setDate(next)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="income-source">Source</Label>
            <Input
              id="income-source"
              placeholder="Employer, client, bank…"
              autoComplete="off"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="income-account">Deposited to</Label>
            <AccountSelect
              id="income-account"
              value={accountId}
              onChange={setAccountId}
            />
          </div>

          <AffectBalanceToggle
            checked={affectsBalance}
            onChange={setAffectsBalance}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="income-notes">Notes</Label>
            <Textarea
              id="income-notes"
              placeholder="Add a note"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Attachments</Label>
            {income && liveIncome ? (
              <AttachmentManager
                itemId={income.id}
                attachments={liveIncome.attachments}
              />
            ) : (
              <>
                {pendingFiles.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {pendingFiles.map((file, index) => (
                      <li
                        key={`${file.name}-${index}`}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                      >
                        <Paperclip
                          aria-hidden
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="min-w-0 flex-1 truncate text-[14px]">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() =>
                            setPendingFiles((files) =>
                              files.filter((_, i) => i !== index),
                            )
                          }
                          className="text-muted-foreground outline-none transition-colors hover:text-destructive"
                        >
                          <X aria-hidden className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files && event.target.files.length > 0) {
                      const selected = Array.from(event.target.files);
                      setPendingFiles((files) => [...files, ...selected]);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip aria-hidden />
                  Add attachment
                </Button>
              </>
            )}
          </div>

          {error && (
            <p role="alert" className="-mt-1 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : income ? "Save changes" : "Add income"}
            </Button>
            {income && (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                disabled={isSubmitting}
                onClick={onDelete}
              >
                Delete income
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
