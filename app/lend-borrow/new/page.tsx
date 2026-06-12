"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, User, FileText, CalendarDays, Paperclip, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/fields/date-field";
import { AccountSelect } from "@/components/fields/account-select";
import { useAppStore } from "@/lib/store/app-store";

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

export default function NewLendBorrowPage() {
  const router = useRouter();
  const addLendBorrow = useAppStore((state) => state.addLendBorrow);
  const currency = useAppStore((state) => state.data.settings.currency);

  const [type, setType] = useState<"lent" | "borrowed">("lent");
  const [personName, setPersonName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getTodayString());
  const [dueDate, setDueDate] = useState<string>("");
  const [accountId, setAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const addLendBorrowAttachment = useAppStore((state) => state.addLendBorrowAttachment);

  const submit = async () => {
    if (!personName.trim()) {
      setError("Add a person name");
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!description.trim()) {
      setError("Add a description");
      return;
    }

    setIsSubmitting(true);
    try {
      const id = addLendBorrow({
        type,
        personName: personName.trim(),
        amount: parsedAmount,
        description: description.trim(),
        date,
        dueDate: dueDate || undefined,
        accountId: accountId || undefined,
        notes: notes.trim() || undefined,
      });

      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          if (file.size > 50 * 1024 * 1024) {
            toast.error(`${file.name} is larger than 50 MB and was skipped`);
            continue;
          }
          await addLendBorrowAttachment(id, file);
        }
      }

      toast.success(type === "lent" ? "Money lent recorded" : "Money borrowed recorded");
      router.push("/lend-borrow");
    } catch {
      toast.error("Failed to save entry");
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell title="Lend / Borrow Money">
      <div className="flex flex-col gap-6 pt-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="size-5" />
          </Button>
          <h2 className="text-lg font-semibold tracking-tight">Record Entry</h2>
        </div>

        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-3">
            <Label>Type</Label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setType("lent")}
                className={`flex items-center justify-center space-x-2 rounded-xl border p-3 flex-1 transition-colors font-medium ${type === "lent" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
              >
                I lent money
              </button>
              <button
                type="button"
                onClick={() => setType("borrowed")}
                className={`flex items-center justify-center space-x-2 rounded-xl border p-3 flex-1 transition-colors font-medium ${type === "borrowed" ? "border-destructive bg-destructive/5 text-destructive" : "border-border text-muted-foreground hover:bg-accent"}`}
              >
                I borrowed money
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center justify-center">
              <span className="text-2xl text-muted-foreground">{currency}</span>
            </div>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              autoComplete="off"
              value={amount}
              onChange={(e) => {
                const next = e.target.value.replace(/[^\d.]/g, "");
                if (next.split(".").length > 2) return;
                setAmount(next);
              }}
              className="h-16 rounded-2xl border-none bg-accent/50 pl-10 pr-4 text-3xl font-semibold placeholder:text-muted-foreground/40 focus-visible:bg-accent focus-visible:ring-0"
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Who?</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Person Name (e.g. Rahul)"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>For what?</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Description (e.g. Dinner at XYZ)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Date</Label>
                <DateField value={date} onChange={setDate} />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-1 whitespace-nowrap">
                  Due Date <span className="text-[11px] font-normal text-muted-foreground">(Optional)</span>
                </Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none" />
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1">
                Source Account <span className="text-[11px] font-normal text-muted-foreground">(Optional)</span>
              </Label>
              <AccountSelect value={accountId} onChange={(v) => setAccountId(v || "")} />
              <span className="text-[12px] text-muted-foreground">
                For tracking only. No ledger transaction will be created.
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1">
                Notes <span className="text-[11px] font-normal text-muted-foreground">(Optional)</span>
              </Label>
              <Textarea
                placeholder="Additional details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1">
                Attachments <span className="text-[11px] font-normal text-muted-foreground">(Optional)</span>
              </Label>
              {pendingFiles.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {pendingFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                    >
                      <Paperclip aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-[14px]">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() =>
                          setPendingFiles((files) => files.filter((_, i) => i !== index))
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
                className="self-start"
              >
                <Paperclip className="size-4 mr-2" aria-hidden />
                Add attachment
              </Button>
            </div>
          </div>

          {error && <div className="text-sm font-medium text-destructive">{error}</div>}

          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full rounded-2xl h-12 text-base">
            Save Entry
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
