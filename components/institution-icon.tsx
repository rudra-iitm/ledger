"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { Institution } from "@/lib/institutions/registry";
import { InstitutionLogoSvg } from "@/lib/institutions/icons";
import { GenericAccountSvg } from "@/lib/institutions/generic-icons";
import { cn } from "@/lib/utils";

import type { AccountType, AssetType } from "@/lib/domain/types";

interface InstitutionIconProps {
  institution?: Institution | null;
  type?: AccountType;
  assetType?: AssetType;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function InstitutionIcon({ institution, type = "bank", assetType, size = "md", className }: InstitutionIconProps) {
  const [imageError, setImageError] = useState<"none" | "clearbit" | "google">("none");

  const sizeClasses = {
    xs: "size-5 rounded text-[10px]",
    sm: "size-8 rounded-lg text-sm",
    md: "size-10 rounded-xl text-xl",
    lg: "size-12 rounded-2xl text-2xl",
    xl: "size-16 rounded-[20px] text-3xl",
  };

  if (!institution || assetType === "gold" || assetType === "silver") {
    return (
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden border border-white/5 bg-[#121212] shadow-sm",
          sizeClasses[size],
          className
        )}
      >
        <GenericAccountSvg type={type} assetType={assetType} className="size-full" />
      </span>
    );
  }

  const hasSvg = ["hdfc", "sbi", "visa", "mastercard"].includes(institution.id);
  
  const customUrls: Record<string, string> = {
    indianbank: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/Indian_Bank_logo_2023.png/250px-Indian_Bank_logo_2023.png"
  };

  const clearbitUrl = institution.domain ? `https://logo.clearbit.com/${institution.domain}?size=128` : null;
  const googleUrl = institution.domain ? `https://www.google.com/s2/favicons?domain=${institution.domain}&sz=128` : null;

  const currentUrl = customUrls[institution.id] || (imageError === "none" ? clearbitUrl : (imageError === "clearbit" ? googleUrl : null));

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center overflow-hidden justify-center border border-white/5 bg-[#121212] shadow-sm",
        sizeClasses[size],
        className
      )}
      style={{
        boxShadow: `0 4px 12px -2px ${institution.accentColor}25, inset 0 1px 0 0 rgba(255,255,255,0.05)`,
        backgroundColor: (!hasSvg && currentUrl) ? "#FFFFFF" : undefined
      }}
    >
      {hasSvg ? (
        <InstitutionLogoSvg id={institution.id} className="size-full" />
      ) : currentUrl ? (
        <img 
          src={currentUrl} 
          alt={institution.name}
          onError={() => setImageError(prev => prev === "none" ? "clearbit" : "google")}
          className="size-full object-contain"
        />
      ) : (
        <span className="font-semibold text-white">
          {institution.name.charAt(0)}
        </span>
      )}
    </span>
  );
}
