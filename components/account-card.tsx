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

  const brandColor = institution?.accentColor || "#FFFFFF";

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
      
      {/* Card Header */}
      <div className="relative flex items-start justify-between">
        <InstitutionIcon 
          institution={institution} 
          type={account.type} 
          size="md" 
        />
        <div className="flex flex-col items-end">
          <span className="font-medium text-white/90 text-[15px]">
            {institution ? institution.name : account.name}
          </span>
          <span className="text-[13px] text-white/50">
            {ACCOUNT_TYPE_LABELS[account.type]}
          </span>
        </div>
      </div>

      {/* Card Footer (Balance) */}
      <div className="relative mt-12 flex items-end justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-medium tracking-wide text-white/40 uppercase">
            Available Balance
          </span>
          <span className="text-3xl font-semibold tracking-tight text-white tabular-nums">
            {formatMoney(account.balance, currency)}
          </span>
        </div>
        
        {/* Decorative Card Chip / Logo Space */}
        {institution?.type === "network" || institution?.type === "credit_card" ? (
           <div className="size-8 rounded bg-white/10" />
        ) : null}
      </div>
    </div>
  );
}
