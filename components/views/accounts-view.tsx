"use client";

import Link from "next/link";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { useSheets } from "@/components/sheets/sheet-context";
// Removed unused accountSummary import
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { AccountCard } from "@/components/account-card";

export function AccountsView() {
  const accounts = useAppStore((state) => state.data.accounts);
  const currency = useAppStore((state) => state.data.settings.currency);
  const sheets = useSheets();

  const active = accounts.filter((account) => !account.archived);
  const totalBalance = active.reduce((sum, account) => sum + account.balance, 0);

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Total balance"
        className="rounded-2xl border border-border bg-card shadow-soft px-5 py-5"
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
        <ul className="flex flex-col gap-4">
          {active.map((account) => {
            return (
              <li key={account.id}>
                <Link
                  href={`/account/?id=${account.id}`}
                  className="block rounded-[20px] outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <AccountCard account={account} currency={currency} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
