"use client";

import { CalendarDays } from "lucide-react";
import { formatDisplayDate } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

export function DateField({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  ariaLabel,
  className,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "relative flex h-12 cursor-pointer items-center gap-2.5 rounded-xl border border-input bg-card px-4 transition-[border-color,box-shadow,background-color] duration-200 focus-within:border-ring/60 focus-within:bg-accent/30 focus-within:ring-4 focus-within:ring-ring/15",
        className,
      )}
    >
      <CalendarDays
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span
        className={cn(
          "truncate text-base",
          !value && "text-muted-foreground",
        )}
      >
        {value ? formatDisplayDate(value) : placeholder}
      </span>
      <input
        id={id}
        type="date"
        aria-label={ariaLabel}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}
