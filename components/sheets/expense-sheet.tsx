"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Tag as TagIcon, X } from "lucide-react";
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
import { AttachmentManager } from "@/components/fields/attachment-manager";
import { DateField } from "@/components/fields/date-field";
import { SpaceSelect } from "@/components/fields/space-select";
import { TagInput } from "@/components/fields/tag-input";
import { CATEGORIES, categorySchema, type Expense } from "@/lib/domain/types";
import { todayISO } from "@/lib/domain/dates";
import { inferCategory } from "@/lib/domain/quick-add";
import { useAppStore } from "@/lib/store/app-store";

export function ExpenseSheet({
  open,
  expense,
  defaults,
  onClose,
}: {
  open: boolean;
  expense?: Expense;
  defaults?: Partial<Expense>;
  onClose: () => void;
}) {
  const addExpense = useAppStore((state) => state.addExpense);
  const updateExpense = useAppStore((state) => state.updateExpense);
  const deleteExpense = useAppStore((state) => state.deleteExpense);
  const addAttachment = useAppStore((state) => state.addAttachment);
  const currency = useAppStore((state) => state.data.settings.currency);
  const liveExpense = useAppStore((state) =>
    expense ? state.data.expenses.find((item) => item.id === expense.id) : undefined,
  );

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Expense["category"]>("Other");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<string | undefined>();
  const [spaceId, setSpaceId] = useState<string | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setDescription(expense.description);
      setAmount(String(expense.amount));
      setCategory(expense.category);
      setCategoryTouched(true);
      setDate(expense.date);
      setAccountId(expense.accountId);
      setSpaceId(expense.spaceId);
      setTags(expense.tags);
      setNotes(expense.notes ?? "");
      setShowExtras(
        expense.tags.length > 0 ||
          !!expense.notes ||
          !!expense.accountId ||
          !!expense.spaceId ||
          expense.attachments.length > 0,
      );
    } else {
      setDescription("");
      setAmount("");
      setCategory("Other");
      setCategoryTouched(false);
      setDate(defaults?.date ?? todayISO());
      setAccountId(defaults?.accountId);
      setSpaceId(defaults?.spaceId);
      setTags([]);
      setNotes("");
      setShowExtras(!!defaults?.spaceId || !!defaults?.accountId);
      setPendingFiles([]);
    }
    setError(null);
    setIsSubmitting(false);
  }, [open, expense, defaults]);

  const onDescriptionChange = (value: string) => {
    setDescription(value);
    if (!categoryTouched && !expense) {
      setCategory(inferCategory(value));
    }
  };

  const submit = async () => {
    if (isSubmitting) return;
    const parsedAmount = Number(amount);
    if (!description.trim()) {
      setError("Add a description");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }

    const payload = {
      description: description.trim(),
      amount: parsedAmount,
      category,
      date,
      accountId,
      spaceId,
      tags,
      notes: notes.trim() || undefined,
    };

    setIsSubmitting(true);
    try {
      if (expense) {
        updateExpense(expense.id, payload);
        toast.success("Expense updated");
      } else {
        const id = addExpense(payload);
        if (pendingFiles.length > 0) {
          for (const file of pendingFiles) {
            if (file.size > 50 * 1024 * 1024) {
              toast.error(`${file.name} is larger than 50 MB and was skipped`);
              continue;
            }
            await addAttachment(id, file);
          }
        }
        toast.success("Expense added");
      }
      onClose();
    } catch {
      toast.error("Failed to save expense or upload attachments");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDelete = () => {
    if (!expense) return;
    deleteExpense(expense.id);
    toast.success("Expense deleted");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{expense ? "Edit expense" : "Add expense"}</SheetTitle>
        </SheetHeader>

        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
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
                const next = event.target.value.replace(/[^\d.]/g, "");
                setAmount(next);
                setError(null);
              }}
              className="w-40 bg-transparent text-center text-5xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              placeholder="What was it for?"
              autoComplete="off"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => {
                  setCategory(categorySchema.parse(value));
                  setCategoryTouched(true);
                }}
              >
                <SelectTrigger id="expense-category">
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
              <Label htmlFor="expense-date">Date</Label>
              <DateField
                id="expense-date"
                value={date}
                onChange={(next) => next && setDate(next)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-account">Paid via</Label>
            <AccountSelect
              id="expense-account"
              value={accountId}
              onChange={setAccountId}
            />
          </div>

          {error && (
            <p role="alert" className="-mt-1 text-sm text-destructive">
              {error}
            </p>
          )}

          {showExtras ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="expense-space">Space</Label>
                <SpaceSelect
                  id="expense-space"
                  value={spaceId}
                  onChange={setSpaceId}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Tags</Label>
                <TagInput value={tags} onChange={setTags} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="expense-notes">Notes</Label>
                <Textarea
                  id="expense-notes"
                  placeholder="Add a note"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Attachments</Label>
                {expense && liveExpense ? (
                  <AttachmentManager
                    expenseId={expense.id}
                    attachments={liveExpense.attachments}
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
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowExtras(true)}
              className="inline-flex items-center gap-2 self-start rounded-lg text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <TagIcon aria-hidden className="size-3.5" />
              Add space, tags, notes & attachments
            </button>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : expense ? "Save changes" : "Add expense"}
            </Button>
            {expense && (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                disabled={isSubmitting}
                onClick={onDelete}
              >
                Delete expense
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
