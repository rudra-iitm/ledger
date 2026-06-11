"use client";

import Link from "next/link";
import { ChevronRight, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { useSheets } from "@/components/sheets/sheet-context";
import { ACCOUNT_TYPE_LABELS } from "@/components/sheets/account-sheet";
import { accountSummary } from "@/lib/domain/accounts";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";

export function AccountsView() {
  const accounts = useAppStore((state) => state.data.accounts);
  const expenses = useAppStore((state) => state.data.expenses);
  const currency = useAppStore((state) => state.data.settings.currency);
  const sheets = useSheets();

  const active = accounts.filter((account) => !account.archived);
  const totalBalance = active.reduce((sum, account) => sum + account.balance, 0);

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Total balance"
        className="rounded-2xl border border-border bg-card px-5 py-5"
      >
        <p className="text-[13px] text-muted-foreground">Total balance</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {formatMoney(totalBalance, currency)}
        </p>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">
          Accounts
        </h2>
        <Button size="sm" onClick={() => sheets.openAccount()}>
          <Plus aria-hidden />
          New
        </Button>
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts"
          description="Add the accounts your money lives in to track where spending comes from."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((account) => {
            const summary = accountSummary(expenses, account);
            return (
              <li key={account.id}>
                <Link
                  href={`/account/?id=${account.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span aria-hidden className="text-xl">
                    {account.icon}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-medium">
                      {account.name}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {ACCOUNT_TYPE_LABELS[account.type]} ·{" "}
                      {summary.totalTransactions} txns
                    </span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">
                    {formatMoney(account.balance, currency)}
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
