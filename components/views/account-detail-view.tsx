"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Pencil, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ExpenseRow } from "@/components/expense-row";
import { useSheets } from "@/components/sheets/sheet-context";
import { AccountCard } from "@/components/account-card";
import { accountExpenses, accountSummary } from "@/lib/domain/accounts";
import { formatDisplayDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { AccountMetadataView } from "@/components/account-metadata";
import { DebitCardsSection } from "@/components/debit-cards-section";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card shadow-soft px-4 py-3.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function AccountDetailView() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get("id");
  const account = useAppStore((state) =>
    state.data.accounts.find((item) => item.id === accountId),
  );
  const expenses = useAppStore((state) => state.data.expenses);
  const currency = useAppStore((state) => state.data.settings.currency);
  const sheets = useSheets();

  const owned = useMemo(
    () =>
      account
        ? accountExpenses(expenses, account.id).sort((a, b) =>
            a.date === b.date
              ? b.createdAt.localeCompare(a.createdAt)
              : b.date.localeCompare(a.date),
          )
        : [],
    [expenses, account],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof owned>();
    for (const expense of owned) {
      const list = groups.get(expense.date) ?? [];
      list.push(expense);
      groups.set(expense.date, list);
    }
    return Array.from(groups.entries());
  }, [owned]);

  if (!account) {
    return (
      <EmptyState
        icon={Wallet}
        title="Account not found"
        description="It may have been deleted on another device."
      />
    );
  }

  const summary = accountSummary(expenses, account);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Accounts
        </Link>
        <Button variant="ghost" size="sm" onClick={() => sheets.openAccount(account)}>
          <Pencil aria-hidden />
          Edit
        </Button>
      </div>

      <div className="mb-4">
        <AccountCard account={account} currency={currency} />
      </div>

      <AccountMetadataView account={account} currency={currency} />
      
      {account.type === "bank" && (
        <DebitCardsSection account={account} currency={currency} />
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat 
          label={account.type === "credit_card" ? "Outstanding" : "Balance"} 
          value={account.type === "credit_card" && account.balance > 0
            ? formatMoney(-account.balance, currency)
            : formatMoney(account.balance, currency)} 
        />
        <Stat
          label="This month"
          value={formatMoney(summary.monthlySpending, currency)}
        />
        <Stat label="Transactions" value={String(summary.totalTransactions)} />
      </div>

      <section aria-label="Transactions">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Transactions
        </h3>
        {grouped.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No transactions"
            description="Expenses paid via this account will show up here."
          />
        ) : (
          <div className="flex flex-col gap-5">
            {grouped.map(([date, items]) => (
              <section key={date} aria-label={formatDisplayDate(date)}>
                <h4 className="mb-1 px-0.5 text-[13px] font-medium text-muted-foreground">
                  {formatDisplayDate(date)}
                </h4>
                <ul className="-mx-2 flex flex-col">
                  {items.map((expense) => (
                    <ExpenseRow key={expense.id} expense={expense} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
