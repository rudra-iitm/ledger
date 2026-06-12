"use client";

import { useState } from "react";

import Link from "next/link";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { useSheets } from "@/components/sheets/sheet-context";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { AccountCard } from "@/components/account-card";

export function AccountsView() {
  const accounts = useAppStore((state) => state.data.accounts);
  const currency = useAppStore((state) => state.data.settings.currency);
  const sheets = useSheets();

  const [includeOutstanding, setIncludeOutstanding] = useState(false);

  const active = accounts.filter((account) => !account.archived);
  
  const totalBalance = active.reduce(
    (sum, account) => {
      if (account.type === "credit_card") {
        return includeOutstanding ? sum - Math.abs(account.balance) : sum;
      }
      return sum + account.balance;
    },
    0,
  );

  const breakdownAccounts = includeOutstanding 
    ? active 
    : active.filter(a => a.type !== "credit_card");

  const totalAbsolute = breakdownAccounts.reduce((sum, account) => sum + Math.abs(account.balance), 0);

  const COLORS = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-pink-500",
    "bg-cyan-500",
    "bg-rose-500",
  ];

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Total balance"
        className="rounded-2xl border border-border bg-card shadow-soft px-5 py-5 flex flex-col"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] text-muted-foreground">Total balance</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {formatMoney(totalBalance, currency)}
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-1.5 mt-1">
            <button 
              role="switch"
              aria-checked={includeOutstanding}
              onClick={() => setIncludeOutstanding(prev => !prev)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${includeOutstanding ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform ${includeOutstanding ? 'translate-x-2' : '-translate-x-2'}`} />
            </button>
            <span className="text-[10px] text-muted-foreground max-w-[80px] text-right leading-tight">
              {includeOutstanding ? "Including Debt" : "Excluding Debt"}
            </span>
          </div>
        </div>

        {breakdownAccounts.length > 0 && totalAbsolute > 0 && (
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/50">
              {breakdownAccounts.map((account, index) => {
                const share = (Math.abs(account.balance) / totalAbsolute) * 100;
                if (share === 0) return null;
                return (
                  <div
                    key={account.id}
                    style={{ width: `${share}%` }}
                    className={`h-full ${COLORS[index % COLORS.length]} transition-all duration-500`}
                    title={`${account.name}: ${share.toFixed(1)}%`}
                  />
                );
              })}
            </div>
            
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {breakdownAccounts.map((account, index) => {
                const share = (Math.abs(account.balance) / totalAbsolute) * 100;
                if (share === 0) return null;
                const isDebt = account.type === "credit_card";
                return (
                  <div key={account.id} className="flex items-center gap-1.5 text-xs">
                    <span className={`size-2.5 rounded-full ${COLORS[index % COLORS.length]}`} />
                    <span className="font-medium truncate max-w-[100px]">{account.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {share.toFixed(0)}%
                    </span>
                    {isDebt && (
                      <span className="text-red-500/80 font-medium ml-0.5">
                        (-{formatMoney(Math.abs(account.balance), currency)})
                      </span>
                    )}
                    {!isDebt && (
                      <span className="text-muted-foreground ml-0.5">
                        ({formatMoney(account.balance, currency)})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
