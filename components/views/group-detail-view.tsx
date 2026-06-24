"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  HandCoins,
  Plus,
  ReceiptText,
  RefreshCw,
  Share2,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/fields/date-field";
import { EmptyState } from "@/components/empty-state";
import { QrCode } from "@/components/qr-code";
import { useSheets } from "@/components/sheets/sheet-context";
import { groupSyncEnabled } from "@/lib/groups/sync";
import { computeBalances, optimizeSettlements } from "@/lib/domain/settlement";
import { formatDisplayDate, todayISO } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function GroupDetailView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const groupId = searchParams.get("id");
  const group = useAppStore((state) =>
    state.data.groups.find((item) => item.id === groupId),
  );
  const currency = useAppStore((state) => state.data.settings.currency);
  const deleteGroup = useAppStore((state) => state.deleteGroup);
  const deleteGroupExpense = useAppStore((state) => state.deleteGroupExpense);
  const addMember = useAppStore((state) => state.addMember);
  const recordGroupSettlement = useAppStore(
    (state) => state.recordGroupSettlement,
  );
  const deleteGroupSettlement = useAppStore(
    (state) => state.deleteGroupSettlement,
  );
  const shareGroup = useAppStore((state) => state.shareGroup);
  const syncGroup = useAppStore((state) => state.syncGroup);
  const sheets = useSheets();

  const remoteId = group?.remoteId;
  const localGroupId = group?.id;

  useEffect(() => {
    if (!remoteId || !localGroupId) return;
    void syncGroup(localGroupId);
    const interval = setInterval(() => void syncGroup(localGroupId), 15000);
    const onFocus = () => void syncGroup(localGroupId);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [remoteId, localGroupId, syncGroup]);

  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleFrom, setSettleFrom] = useState("");
  const [settleTo, setSettleTo] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDate, setSettleDate] = useState(todayISO());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!group) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="Group not found"
        description="It may have been deleted on another device."
      />
    );
  }

  const membersById = new Map(
    group.members.map((member) => [member.id, member.name]),
  );
  const nameOf = (id: string) => membersById.get(id) ?? "Unknown";

  const balances = computeBalances(group);
  const settlements = optimizeSettlements(balances);

  const submitMember = () => {
    const name = memberName.trim();
    if (!name) return;
    addMember(group.id, name);
    toast.success(`${name} added to ${group.name}`);
    setMemberName("");
    setMemberDialogOpen(false);
  };

  const openSettle = (prefill?: { from: string; to: string; amount: number }) => {
    setSettleFrom(prefill?.from ?? group.members[0]?.id ?? "");
    setSettleTo(prefill?.to ?? group.members[1]?.id ?? "");
    setSettleAmount(prefill ? String(prefill.amount) : "");
    setSettleDate(todayISO());
    setSettleOpen(true);
  };

  const settleAmountValue = Number(settleAmount);
  const settleValid =
    settleFrom !== "" &&
    settleTo !== "" &&
    settleFrom !== settleTo &&
    Number.isFinite(settleAmountValue) &&
    settleAmountValue > 0;

  const submitSettle = () => {
    if (!settleValid) return;
    recordGroupSettlement(group.id, {
      from: settleFrom,
      to: settleTo,
      amount: settleAmountValue,
      date: settleDate,
    });
    toast.success("Payment recorded");
    setSettleOpen(false);
  };

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const inviteUrl =
    group.remoteId && typeof window !== "undefined"
      ? `${window.location.origin}${basePath}/groups/join/?code=${group.remoteId}`
      : "";

  const openInvite = async () => {
    if (group.remoteId) {
      setInviteOpen(true);
      return;
    }
    setSharing(true);
    const ok = await shareGroup(group.id);
    setSharing(false);
    if (ok) {
      setInviteOpen(true);
      toast.success("Sharing enabled");
    } else {
      toast.error("Couldn't enable sharing");
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/groups")}
          className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Groups
        </button>
        <div className="flex items-center gap-1">
          {groupSyncEnabled() && (
            <Button
              variant="ghost"
              size="sm"
              disabled={sharing}
              onClick={() => void openInvite()}
            >
              <Share2 aria-hidden />
              {sharing ? "…" : "Invite"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 aria-hidden />
            Delete
          </Button>
        </div>
      </div>

      <section aria-label="Group">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{group.name}</h2>
          {group.remoteId && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
              <RefreshCw aria-hidden className="size-3" />
              Synced
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {group.members.map((member) => (
            <span
              key={member.id}
              className="rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground"
            >
              {member.name}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setMemberDialogOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <UserPlus aria-hidden className="size-3.5" />
            Add
          </button>
        </div>
      </section>

      <section aria-label="Settle up">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            Settle up
          </h3>
          <Button size="sm" variant="secondary" onClick={() => openSettle()}>
            <HandCoins aria-hidden />
            Record payment
          </Button>
        </div>
        {settlements.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card shadow-soft px-4 py-4 text-sm text-muted-foreground">
            All settled. Nobody owes anything.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {settlements.map((settlement, index) => (
              <li
                key={index}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card shadow-soft px-4 py-3.5"
              >
                <span className="min-w-0 flex-1 truncate text-base">
                  <span className="font-medium">{nameOf(settlement.from)}</span>
                  <ArrowRight
                    aria-label="pays"
                    className="mx-2 inline size-4 text-muted-foreground"
                  />
                  <span className="font-medium">{nameOf(settlement.to)}</span>
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {formatMoney(settlement.amount, currency)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-positive hover:text-positive"
                  onClick={() => openSettle(settlement)}
                >
                  <Check aria-hidden />
                  Mark paid
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {group.settlements.length > 0 && (
        <section aria-label="Payments">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Payments
          </h3>
          <ul className="flex flex-col gap-2">
            {group.settlements.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card shadow-soft px-4 py-3.5"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base">
                    <span className="font-medium">{nameOf(payment.from)}</span>
                    <ArrowRight
                      aria-label="paid"
                      className="mx-2 inline size-4 text-muted-foreground"
                    />
                    <span className="font-medium">{nameOf(payment.to)}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatDisplayDate(payment.date)}
                  </span>
                </span>
                <span className="text-base font-semibold tabular-nums text-positive">
                  {formatMoney(payment.amount, currency)}
                </span>
                <button
                  type="button"
                  aria-label="Delete payment"
                  onClick={() => {
                    deleteGroupSettlement(group.id, payment.id);
                    toast.success("Payment removed");
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground outline-none transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Balances">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Balances
        </h3>
        <ul className="flex flex-col gap-1.5">
          {group.members.map((member) => {
            const balance = balances.get(member.id) ?? 0;
            return (
              <li
                key={member.id}
                className="flex items-center justify-between px-1 py-1 text-base"
              >
                <span>{member.name}</span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    balance > 0 && "text-positive",
                    balance < 0 && "text-destructive",
                    balance === 0 && "text-muted-foreground",
                  )}
                >
                  {balance > 0 ? "+" : ""}
                  {formatMoney(balance, currency)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Group expenses">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            Expenses
          </h3>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => sheets.openGroupExpense(group.id)}
          >
            <Plus aria-hidden />
            Add expense
          </Button>
        </div>
        {group.expenses.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No expenses yet"
            description="Add the first shared expense to start tracking who owes whom."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {group.expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card shadow-soft px-4 py-3.5"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-medium">
                    {expense.description}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {nameOf(expense.paidBy)} paid ·{" "}
                    {expense.splitAmong.length} people ·{" "}
                    {formatDisplayDate(expense.date)}
                  </span>
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {formatMoney(expense.amount, currency)}
                </span>
                <button
                  type="button"
                  aria-label={`Delete ${expense.description}`}
                  onClick={() => {
                    deleteGroupExpense(group.id, expense.id);
                    toast.success("Expense removed");
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground outline-none transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>
              New members are included in future splits.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitMember();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="member-name">Name</Label>
              <Input
                id="member-name"
                placeholder="Priya"
                autoComplete="off"
                value={memberName}
                onChange={(event) => setMemberName(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={!memberName.trim()}>
              Add member
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite to {group.name}</DialogTitle>
            <DialogDescription>
              Anyone with this link can join the group and share expenses.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {inviteUrl && (
              <div className="rounded-2xl bg-white p-3 shadow-soft">
                <QrCode value={inviteUrl} size={200} />
              </div>
            )}
            <div className="flex w-full items-center gap-2">
              <Input readOnly value={inviteUrl} className="flex-1" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Copy invite link"
                onClick={() => void copyInvite()}
              >
                <Copy aria-hidden />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              Mark a debt as settled between two members.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitSettle();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>From</Label>
                <Select value={settleFrom} onValueChange={setSettleFrom}>
                  <SelectTrigger>
                    <SelectValue placeholder="Payer" />
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
              <div className="flex flex-col gap-2">
                <Label>To</Label>
                <Select value={settleTo} onValueChange={setSettleTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Payee" />
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
              <Label htmlFor="settle-amount">Amount</Label>
              <Input
                id="settle-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0"
                value={settleAmount}
                onChange={(event) => setSettleAmount(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="settle-date">Date</Label>
              <DateField
                id="settle-date"
                value={settleDate}
                onChange={(next) => next && setSettleDate(next)}
              />
            </div>
            {settleFrom !== "" && settleFrom === settleTo && (
              <p className="text-sm text-destructive">
                Payer and payee must be different.
              </p>
            )}
            <Button type="submit" disabled={!settleValid}>
              Record payment
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {group.name}?</DialogTitle>
            <DialogDescription>
              This removes the group and all its expenses. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                deleteGroup(group.id);
                toast.success("Group deleted");
                router.push("/groups");
              }}
            >
              Delete group
            </Button>
            <Button variant="secondary" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
