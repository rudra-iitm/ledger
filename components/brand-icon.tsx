"use client";

/* eslint-disable @next/next/no-img-element */
import { BrandLogoSvg } from "@/lib/brands/icons";
import type { Brand } from "@/lib/brands/registry";
import { useState } from "react";
import { CategoryIcon } from "@/components/category-icon";
import type { Category } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

interface BrandIconProps {
  brand?: Brand | null;
  fallbackCategory?: Category;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function BrandIcon({ brand, fallbackCategory, size = "sm", className }: BrandIconProps) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: "size-10 rounded-xl",
    md: "size-12 rounded-2xl",
    lg: "size-14 rounded-[16px]",
  };

  const iconClasses = {
    sm: "size-7",
    md: "size-8",
    lg: "size-10",
  };

  if (!brand) {
    if (fallbackCategory) {
      return (
        <CategoryIcon
          category={fallbackCategory}
          className={cn(sizeClasses[size], "border-border shadow-sm", className)}
        />
      );
    }
    return (
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center border border-border bg-card text-muted-foreground shadow-sm",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  const logoUrl = brand.domain ? `https://www.google.com/s2/favicons?domain=${brand.domain}&sz=128` : null;

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center overflow-hidden justify-center border border-white/5 bg-[#121212] shadow-sm",
        sizeClasses[size],
        className
      )}
      style={{
        boxShadow: `0 4px 12px -2px ${brand.accentColor}25, inset 0 1px 0 0 rgba(255,255,255,0.05)`,
      }}
    >
      {logoUrl && !imageError ? (
        <img 
          src={logoUrl} 
          alt={brand.name}
          onError={() => setImageError(true)}
          className="size-full object-contain"
        />
      ) : (
        <BrandLogoSvg 
          id={brand.id} 
          className={iconClasses[size]} 
        />
      )}
    </span>
  );
}
