"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { formatMoney } from "@/lib/domain/money";
import { formatDisplayDate } from "@/lib/domain/dates";
import { useAppStore } from "@/lib/store/app-store";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DateField } from "@/components/fields/date-field";
import { ArrowLeft, Plus, CheckCircle2, History, User } from "lucide-react";
import { AttachmentManager } from "@/components/fields/attachment-manager";
import { cn } from "@/lib/utils";

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

export function LendBorrowDetailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const lendBorrows = useAppStore((state) => state.data.lendBorrows);
  const addLendBorrowRepayment = useAppStore((state) => state.addLendBorrowRepayment);
  const deleteLendBorrow = useAppStore((state) => state.deleteLendBorrow);
  const settings = useAppStore((state) => state.data.settings);

  const item = lendBorrows.find((i) => i.id === id);

  const [repaymentOpen, setRepaymentOpen] = useState(false);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayDate, setRepayDate] = useState(getTodayString());
  const [error, setError] = useState<string | null>(null);

  if (!item) {
    return (
      <AppShell title="Not Found">
        <div className="flex flex-col items-center justify-center pt-20 text-muted-foreground">
          Entry not found.
          <Button variant="ghost" onClick={() => router.push("/lend-borrow")}>
            Go back
          </Button>
        </div>
      </AppShell>
    );
  }

  const repaid = item.repayments.reduce((sum, r) => sum + r.amount, 0);
  const outstanding = item.amount - repaid;

  let status = "Active";
  let statusClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (outstanding <= 0) {
    status = "Settled";
    statusClass = "bg-green-500/10 text-green-600 dark:text-green-400";
  } else if (repaid > 0) {
    status = "Partially Settled";
    statusClass = "bg-orange-500/10 text-orange-600 dark:text-orange-400";
  } else if (item.dueDate && new Date(item.dueDate) < new Date()) {
    status = "Overdue";
    statusClass = "bg-destructive/10 text-destructive";
  }

  const handleRepay = () => {
    const parsedAmount = Number(repayAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (parsedAmount > outstanding) {
      setError(`Amount exceeds outstanding balance (${outstanding})`);
      return;
    }

    addLendBorrowRepayment(item.id, {
      amount: parsedAmount,
      date: repayDate,
    });
    toast.success("Repayment recorded");
    setRepaymentOpen(false);
    setRepayAmount("");
    setRepayDate(getTodayString());
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this entry?")) {
      deleteLendBorrow(item.id);
      toast.success("Entry deleted");
      router.push("/lend-borrow");
    }
  };

  return (
    <AppShell title="Details">
      <div className="flex flex-col gap-6 pt-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shrink-0">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex flex-col flex-1 min-w-0">
            <h2 className="text-lg font-semibold tracking-tight truncate">{item.personName}</h2>
            <span className="text-[13px] text-muted-foreground capitalize">{item.type}</span>
          </div>
          <Button variant="outline" size="sm" className="rounded-full text-xs shrink-0" onClick={() => router.push(`/lend-borrow/person/detail?name=${encodeURIComponent(item.personName)}`)}>
            <User className="size-3.5 mr-1" />
            History
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center gap-2 rounded-3xl bg-accent p-8">
          <span className="text-sm font-medium text-muted-foreground">Outstanding</span>
          <span className="text-5xl font-bold tracking-tight">
            {formatMoney(outstanding, settings.currency)}
          </span>
          <div className={cn("mt-2 rounded-full px-3 py-1 text-xs font-medium", statusClass)}>
            {status}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Original Amount</span>
            <span className="font-semibold">{formatMoney(item.amount, settings.currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Date</span>
            <span className="font-medium">{formatDisplayDate(item.date)}</span>
          </div>
          {item.dueDate && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Due Date</span>
              <span className="font-medium">{formatDisplayDate(item.dueDate)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Description</span>
            <span className="font-medium">{item.description}</span>
          </div>
          {item.notes && (
            <div className="flex flex-col gap-1 mt-2">
              <span className="text-sm text-muted-foreground">Notes</span>
              <p className="text-sm">{item.notes}</p>
            </div>
          )}
          <div className="flex flex-col gap-2 mt-2">
            <span className="text-sm text-muted-foreground">Attachments</span>
            <AttachmentManager
              itemId={item.id}
              attachments={item.attachments}
              type="lendBorrow"
            />
          </div>
        </div>

        {outstanding > 0 && (
          <Dialog open={repaymentOpen} onOpenChange={setRepaymentOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="w-full rounded-2xl h-12 text-base gap-2">
                <Plus className="size-5" /> Record Repayment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Record Repayment</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 pt-4">
                <div className="flex flex-col gap-2">
                  <Label>Amount</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={repayAmount}
                    onChange={(e) => {
                      const next = e.target.value.replace(/[^\d.]/g, "");
                      if (next.split(".").length > 2) return;
                      setRepayAmount(next);
                    }}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Outstanding: {formatMoney(outstanding, settings.currency)}</span>
                    <button type="button" onClick={() => setRepayAmount(String(outstanding))} className="text-primary hover:underline">
                      Settle Full Amount
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Date</Label>
                  <DateField value={repayDate} onChange={setRepayDate} />
                </div>
                {error && <div className="text-sm font-medium text-destructive">{error}</div>}
                <Button size="lg" className="w-full mt-2" onClick={handleRepay}>
                  Save Repayment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {outstanding <= 0 && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/5 p-4 text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-5" />
            <span className="font-medium">Fully Settled</span>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <History className="size-4" />
            <span className="text-sm font-semibold tracking-tight">Timeline</span>
          </div>

          <div className="flex flex-col gap-4 pl-2">
            <div className="relative flex gap-4 pb-4">
              <div className="absolute left-[7px] top-6 bottom-[-16px] w-[2px] bg-border" />
              <div className="z-10 mt-1 flex size-[16px] items-center justify-center rounded-full bg-primary ring-4 ring-background" />
              <div className="flex flex-col">
                <span className="font-medium">
                  {item.type === "lent" ? "Lent to " : "Borrowed from "} {item.personName}
                </span>
                <span className="text-sm text-muted-foreground">{formatDisplayDate(item.date)}</span>
              </div>
              <div className="ml-auto font-semibold">
                {formatMoney(item.amount, settings.currency)}
              </div>
            </div>

            {item.repayments.sort((a, b) => a.date.localeCompare(b.date)).map((rep, idx) => (
              <div key={rep.id} className="relative flex gap-4 pb-4">
                {idx !== item.repayments.length - 1 && (
                  <div className="absolute left-[7px] top-6 bottom-[-16px] w-[2px] bg-border" />
                )}
                <div className="z-10 mt-1 flex size-[16px] items-center justify-center rounded-full bg-green-500 ring-4 ring-background" />
                <div className="flex flex-col">
                  <span className="font-medium">Repayment Recorded</span>
                  <span className="text-sm text-muted-foreground">{formatDisplayDate(rep.date)}</span>
                </div>
                <div className="ml-auto font-semibold text-green-600 dark:text-green-400">
                  {formatMoney(rep.amount, settings.currency)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border flex justify-center">
          <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleDelete}>
            Delete Entry
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
