"use client";

import { cn } from "@/lib/utils";
import type { Account } from "@/lib/domain/types";
import { formatMoney } from "@/lib/domain/money";
import { ACCOUNT_TYPE_LABELS } from "@/components/sheets/account-sheet";
import { resolveInstitution } from "@/lib/institutions/registry";
import { InstitutionIcon } from "@/components/institution-icon";

interface AccountCardProps {
  account: Account;
  currency: string;
  className?: string;
}

export function AccountCard({ account, currency, className }: AccountCardProps) {
  const institution = resolveInstitution(account.name);

  const isGold = account.assetType === "gold";
  const isSilver = account.assetType === "silver";

  let brandColor = institution?.accentColor || "#FFFFFF";
  if (isGold) brandColor = "#F59E0B";
  else if (isSilver) brandColor = "#94A3B8";

  const displayName = account.type === "investment" ? account.name : (institution ? institution.name : account.name);

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-[20px] p-5 shadow-2xl transition-all duration-300 hover:shadow-xl border border-white/5",
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${brandColor}20 0%, #050505 100%)`,
        boxShadow: `0 8px 32px -8px ${brandColor}25, inset 0 1px 0 0 ${brandColor}30`,
      }}
    >
      
      <div className="relative flex items-start justify-between">
        <InstitutionIcon 
          institution={isGold || isSilver ? null : institution} 
          type={account.type} 
          assetType={account.assetType}
          size="md" 
        />
        <div className="flex flex-col items-end">
          <span className="font-medium text-white/90 text-[15px]">
            {displayName}
          </span>
          <span className="text-[13px] text-white/50">
            {ACCOUNT_TYPE_LABELS[account.type]}
          </span>
        </div>
      </div>

      <div className="relative mt-12 flex items-end justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-medium tracking-wide text-white/40 uppercase">
            {account.type === "credit_card" ? "Outstanding Balance" : "Available Balance"}
          </span>
          <span className="text-3xl font-semibold tracking-tight text-white tabular-nums">
            {account.type === "credit_card" && account.balance > 0
              ? formatMoney(-account.balance, currency)
              : formatMoney(account.balance, currency)}
          </span>
        </div>
        
        {institution?.type === "network" || institution?.type === "credit_card" ? (
           <div className="size-8 rounded bg-white/10" />
        ) : null}
      </div>
    </div>
  );
}
