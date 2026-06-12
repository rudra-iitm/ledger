"use client";

import { useState } from "react";
import { Eye, EyeOff, Info } from "lucide-react";
import type { Account } from "@/lib/domain/types";
import { formatMoney } from "@/lib/domain/money";

export function AccountMetadataView({ account, currency }: { account: Account; currency: string }) {
  const [revealAccountNo, setRevealAccountNo] = useState(false);

  const maskAccountNumber = (num: string) => {
    if (revealAccountNo) return num;
    if (num.length <= 4) return "••••";
    return `•••• •••• ${num.slice(-4)}`;
  };

  if (account.type === "credit_card") {
    const limit = account.creditLimit ?? 0;
    const statement = account.statementBalance ?? 0;
    const outstanding = account.balance ?? 0;
    const available = limit - outstanding;
    const utilization = limit > 0 ? (outstanding / limit) * 100 : 0;

    let ringColor = "stroke-green-500";
    if (utilization > 70) ringColor = "stroke-red-500";
    else if (utilization > 30) ringColor = "stroke-yellow-500";

    const circumference = 2 * Math.PI * 45; // r=45
    const strokeDashoffset = circumference - (utilization / 100) * circumference;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Credit Utilization</h3>
          
          <div className="flex items-center gap-6">
            <div className="relative size-24 flex items-center justify-center shrink-0">
              <svg className="size-full rotate-[-90deg]" viewBox="0 0 100 100">
                <circle className="stroke-muted/30" cx="50" cy="50" r="45" strokeWidth="8" fill="none" />
                <circle 
                  className={`transition-all duration-1000 ease-out ${ringColor}`} 
                  cx="50" cy="50" r="45" strokeWidth="8" fill="none" 
                  strokeDasharray={circumference} 
                  strokeDashoffset={strokeDashoffset} 
                  strokeLinecap="round" 
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-xl font-bold tabular-nums">{Math.round(utilization)}%</span>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Outstanding</span>
                <span className="font-medium tabular-nums">{formatMoney(outstanding, currency)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Available Credit</span>
                <span className="font-medium tabular-nums text-green-500">{formatMoney(Math.max(0, available), currency)}</span>
              </div>
              <div className="w-full h-px bg-border my-0.5" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Limit</span>
                <span className="font-semibold tabular-nums">{formatMoney(limit, currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {statement > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <span className="text-sm text-muted-foreground">Statement Balance</span>
            <span className="font-medium tabular-nums">{formatMoney(statement, currency)}</span>
          </div>
        )}
      </div>
    );
  }

  if (account.type === "bank") {
    const hasMetadata = account.holderName || account.accountNumber || account.ifscCode || account.branchName || account.bankAccountType;
    const hasMinBalance = account.minimumBalance !== undefined && account.minimumBalance > 0;
    
    return (
      <div className="flex flex-col gap-4">
        {hasMinBalance && (
          <div className={`flex flex-col gap-2 rounded-xl border p-4 shadow-sm ${account.balance < account.minimumBalance! ? "border-red-500/50 bg-red-500/10" : "border-border bg-card"}`}>
            <div className="flex justify-between items-center">
              <span className={`text-sm font-medium ${account.balance < account.minimumBalance! ? "text-red-500" : "text-muted-foreground"}`}>
                Minimum Balance
              </span>
              <span className="font-semibold tabular-nums">{formatMoney(account.minimumBalance!, currency)}</span>
            </div>
            {account.balance < account.minimumBalance! ? (
              <p className="text-[13px] text-red-500/80 flex items-center gap-1.5 mt-1">
                <Info className="size-3.5" /> Balance is below minimum requirement.
              </p>
            ) : (
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-muted-foreground">Buffer available:</span>
                <span className="font-medium text-green-500 tabular-nums">+{formatMoney(account.balance - account.minimumBalance!, currency)}</span>
              </div>
            )}
          </div>
        )}

        {hasMetadata && (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Account Details</h3>
            
            {account.holderName && (
              <div className="flex justify-between items-center py-1">
                <span className="text-[13px] text-muted-foreground">Account Holder</span>
                <span className="text-[14px] font-medium">{account.holderName}</span>
              </div>
            )}
            
            {account.accountNumber && (
              <div className="flex justify-between items-center py-1">
                <span className="text-[13px] text-muted-foreground">Account Number</span>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium font-mono tabular-nums tracking-tight">
                    {maskAccountNumber(account.accountNumber)}
                  </span>
                  <button 
                    onClick={() => setRevealAccountNo(!revealAccountNo)}
                    className="text-muted-foreground hover:text-foreground transition-colors outline-none"
                    aria-label={revealAccountNo ? "Hide account number" : "Reveal account number"}
                  >
                    {revealAccountNo ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}

            {account.ifscCode && (
              <div className="flex justify-between items-center py-1">
                <span className="text-[13px] text-muted-foreground">IFSC Code</span>
                <span className="text-[14px] font-medium font-mono">{account.ifscCode}</span>
              </div>
            )}

            {(account.branchName || account.bankAccountType) && (
              <div className="flex justify-between items-center py-1">
                <span className="text-[13px] text-muted-foreground">Variant & Branch</span>
                <span className="text-[14px] font-medium">
                  {[account.bankAccountType, account.branchName].filter(Boolean).join(" • ")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
