"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { CATEGORIES, categorySchema, type Expense } from "@/lib/domain/types";
import { todayISO } from "@/lib/domain/dates";
import { useAppStore } from "@/lib/store/app-store";

const formSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  amount: z.coerce.number().positive("Enter an amount greater than zero"),
  category: categorySchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});

type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

const emptyValues = (): FormInput => ({
  description: "",
  amount: "",
  category: "Other",
  date: todayISO(),
});

export function ExpenseSheet({
  open,
  expense,
  onClose,
}: {
  open: boolean;
  expense?: Expense;
  onClose: () => void;
}) {
  const addExpense = useAppStore((state) => state.addExpense);
  const updateExpense = useAppStore((state) => state.updateExpense);
  const deleteExpense = useAppStore((state) => state.deleteExpense);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (open) {
      form.reset(
        expense
          ? {
              description: expense.description,
              amount: expense.amount,
              category: expense.category,
              date: expense.date,
            }
          : emptyValues(),
      );
    }
  }, [open, expense, form]);

  const onSubmit = (values: FormValues) => {
    if (expense) {
      updateExpense(expense.id, values);
      toast.success("Expense updated");
    } else {
      addExpense(values);
      toast.success("Expense added");
    }
    onClose();
  };

  const onDelete = () => {
    if (!expense) return;
    deleteExpense(expense.id);
    toast.success("Expense deleted");
    onClose();
  };

  const { errors } = form.formState;

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{expense ? "Edit expense" : "Add expense"}</SheetTitle>
        </SheetHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              placeholder="Lunch at office"
              autoComplete="off"
              aria-invalid={!!errors.description}
              {...form.register("description")}
            />
            {errors.description && (
              <p role="alert" className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-amount">Amount</Label>
              <Input
                id="expense-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="450"
                aria-invalid={!!errors.amount}
                {...form.register("amount")}
              />
              {errors.amount && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.amount.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                aria-invalid={!!errors.date}
                {...form.register("date")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-category">Category</Label>
            <Select
              value={form.watch("category")}
              onValueChange={(value) =>
                form.setValue("category", categorySchema.parse(value))
              }
            >
              <SelectTrigger id="expense-category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <Button type="submit" size="lg">
              {expense ? "Save changes" : "Add expense"}
            </Button>
            {expense && (
              <Button
                type="button"
                variant="destructive"
                size="lg"
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
