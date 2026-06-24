"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  Pencil,
  Scale,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ExpenseRow } from "@/components/expense-row";
import { useSheets } from "@/components/sheets/sheet-context";
import { AccountCard } from "@/components/account-card";
import { accountExpenses, accountSummary } from "@/lib/domain/accounts";
import {
  availableCredit,
  remainingStatement,
  statementStatus,
  utilization,
} from "@/lib/domain/balances";
import { formatDisplayDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import type { Account, Expense } from "@/lib/domain/types";
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

const STATUS_STYLES: Record<string, string> = {
  Paid: "bg-emerald-500/15 text-emerald-500",
  "Partially Paid": "bg-amber-500/15 text-amber-500",
  Unpaid: "bg-red-500/15 text-red-500",
};

function CreditStatement({
  account,
  rows,
  currency,
  onPay,
}: {
  account: Account;
  rows: Expense[];
  currency: string;
  onPay: () => void;
}) {
  const outstanding = Math.max(0, account.balance);
  const available = availableCredit(account);
  const util = utilization(account);
  const status = statementStatus(account, rows);
  const remaining = remainingStatement(account, rows);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-5 py-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Statement</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${STATUS_STYLES[status]}`}
        >
          {status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Outstanding" value={formatMoney(outstanding, currency)} />
        {account.creditLimit !== undefined && (
          <Field
            label="Credit limit"
            value={formatMoney(account.creditLimit, currency)}
          />
        )}
        {available !== null && (
          <Field
            label="Available credit"
            value={formatMoney(available, currency)}
          />
        )}
        {account.statementBalance !== undefined && (
          <Field
            label="Statement balance"
            value={formatMoney(account.statementBalance, currency)}
          />
        )}
        {remaining > 0 && (
          <Field
            label="Statement due"
            value={formatMoney(remaining, currency)}
          />
        )}
        {account.minimumDue !== undefined && (
          <Field
            label="Minimum due"
            value={formatMoney(account.minimumDue, currency)}
          />
        )}
        {account.statementDueDate && (
          <Field
            label="Due date"
            value={formatDisplayDate(account.statementDueDate)}
          />
        )}
      </div>

      {util !== null && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <span>Utilization</span>
            <span className="tabular-nums">{util}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                util >= 80
                  ? "bg-red-500"
                  : util >= 50
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${util}%` }}
            />
          </div>
        </div>
      )}

      <Button onClick={onPay} disabled={outstanding <= 0}>
        <CreditCard aria-hidden />
        Pay bill
      </Button>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function PaymentHistory({
  account,
  rows,
  accounts,
  currency,
}: {
  account: Account;
  rows: Expense[];
  accounts: Account[];
  currency: string;
}) {
  const payments = rows
    .filter((row) => row.type === "cc_payment" && row.paymentTargetId === account.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (payments.length === 0) return null;

  const accountName = (id?: string) =>
    accounts.find((item) => item.id === id)?.name ?? "Account";

  return (
    <section aria-label="Payment history" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Payments</h3>
      <ul className="flex flex-col gap-1">
        {payments.map((payment) => (
          <li
            key={payment.id}
            className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-soft"
          >
            <span className="flex flex-col">
              <span className="text-[15px] font-medium">
                {accountName(payment.accountId)}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {formatDisplayDate(payment.date)}
              </span>
            </span>
            <span className="text-[15px] font-semibold tabular-nums text-emerald-500">
              −{formatMoney(payment.amount, currency)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AccountDetailView() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get("id");
  const account = useAppStore((state) =>
    state.data.accounts.find((item) => item.id === accountId),
  );
  const accounts = useAppStore((state) => state.data.accounts);
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
        <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => sheets.openAdjustBalance(account.id)}
          >
            <SlidersHorizontal aria-hidden />
            Adjust
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => sheets.openReconcile(account.id)}
          >
            <Scale aria-hidden />
            Reconcile
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => sheets.openAccount(account)}
          >
            <Pencil aria-hidden />
            Edit
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <AccountCard account={account} currency={currency} />
      </div>

      {account.type === "credit_card" && (
        <>
          <CreditStatement
            account={account}
            rows={expenses}
            currency={currency}
            onPay={() => sheets.openCreditCardPayment(account.id)}
          />
          <PaymentHistory
            account={account}
            rows={expenses}
            accounts={accounts}
            currency={currency}
          />
        </>
      )}

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

      {account.reconciliations.length > 0 && (
        <section aria-label="Reconciliation" className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Reconciliation
          </h3>
          <ul className="flex flex-col gap-1">
            {account.reconciliations.slice(0, 4).map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-soft"
              >
                <span className="flex flex-col">
                  <span className="text-[14px] font-medium">
                    {formatDisplayDate(entry.date)}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {entry.adjusted
                      ? "Adjusted to match"
                      : entry.difference === 0
                        ? "Matched"
                        : "Discrepancy noted"}
                  </span>
                </span>
                <span
                  className={`text-[14px] font-semibold tabular-nums ${
                    entry.difference === 0
                      ? "text-muted-foreground"
                      : entry.difference > 0
                        ? "text-emerald-500"
                        : "text-destructive"
                  }`}
                >
                  {entry.difference > 0 ? "+" : ""}
                  {formatMoney(entry.difference, currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
