"use client";

import { Eye, EyeOff } from "lucide-react";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function ShowInvestmentsToggle({ className }: { className?: string }) {
  const show = useAppStore(
    (state) => state.data.settings.showInvestmentsInExpenses,
  );
  const updateSettings = useAppStore((state) => state.updateSettings);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={show}
      aria-label="Show investments in this list"
      onClick={() =>
        updateSettings({ showInvestmentsInExpenses: !show })
      }
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        show
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {show ? (
        <Eye aria-hidden className="size-3.5" />
      ) : (
        <EyeOff aria-hidden className="size-3.5" />
      )}
      Investments
    </button>
  );
}
