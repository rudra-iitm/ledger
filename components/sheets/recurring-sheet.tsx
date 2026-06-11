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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CATEGORIES,
  categorySchema,
  type RecurringExpense,
} from "@/lib/domain/types";
import { currentMonth } from "@/lib/domain/dates";
import { useAppStore } from "@/lib/store/app-store";

const formSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  amount: z.coerce.number().positive("Enter an amount greater than zero"),
  category: categorySchema,
  dayOfMonth: z.coerce
    .number()
    .int("Whole day of the month")
    .min(1, "Between 1 and 31")
    .max(31, "Between 1 and 31"),
});

type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

const emptyValues = (): FormInput => ({
  description: "",
  amount: "",
  category: "Bills",
  dayOfMonth: 1,
});

export function RecurringSheet({
  open,
  recurring,
  onClose,
}: {
  open: boolean;
  recurring?: RecurringExpense;
  onClose: () => void;
}) {
  const addRecurring = useAppStore((state) => state.addRecurring);
  const updateRecurring = useAppStore((state) => state.updateRecurring);
  const deleteRecurring = useAppStore((state) => state.deleteRecurring);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (open) {
      form.reset(
        recurring
          ? {
              description: recurring.description,
              amount: recurring.amount,
              category: recurring.category,
              dayOfMonth: recurring.dayOfMonth,
            }
          : emptyValues(),
      );
    }
  }, [open, recurring, form]);

  const onSubmit = (values: FormValues) => {
    if (recurring) {
      updateRecurring(recurring.id, values);
      toast.success("Recurring expense updated");
    } else {
      addRecurring({ ...values, startMonth: currentMonth(), active: true });
      toast.success("Recurring expense added");
    }
    onClose();
  };

  const onDelete = () => {
    if (!recurring) return;
    deleteRecurring(recurring.id);
    toast.success("Recurring expense deleted");
    onClose();
  };

  const { errors } = form.formState;

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {recurring ? "Edit recurring" : "Add recurring"}
          </SheetTitle>
          <SheetDescription>
            Added to your expenses automatically every month when due.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="recurring-description">Description</Label>
            <Input
              id="recurring-description"
              placeholder="Rent"
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
              <Label htmlFor="recurring-amount">Amount</Label>
              <Input
                id="recurring-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="15000"
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
              <Label htmlFor="recurring-day">Day of month</Label>
              <Input
                id="recurring-day"
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                aria-invalid={!!errors.dayOfMonth}
                {...form.register("dayOfMonth")}
              />
              {errors.dayOfMonth && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.dayOfMonth.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="recurring-category">Category</Label>
            <Select
              value={form.watch("category")}
              onValueChange={(value) =>
                form.setValue("category", categorySchema.parse(value))
              }
            >
              <SelectTrigger id="recurring-category">
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
              {recurring ? "Save changes" : "Add recurring"}
            </Button>
            {recurring && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    updateRecurring(recurring.id, { active: !recurring.active });
                    toast.success(
                      recurring.active ? "Recurring paused" : "Recurring resumed",
                    );
                    onClose();
                  }}
                >
                  {recurring.active ? "Pause" : "Resume"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  onClick={onDelete}
                >
                  Delete recurring
                </Button>
              </>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
