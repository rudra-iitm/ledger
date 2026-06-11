"use client";

import { cn } from "@/lib/utils";

export function EmojiPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (emoji: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {options.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={`Icon ${emoji}`}
          aria-pressed={value === emoji}
          onClick={() => onChange(emoji)}
          className={cn(
            "flex aspect-square items-center justify-center rounded-xl border text-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            value === emoji
              ? "border-ring bg-accent"
              : "border-border bg-card hover:bg-accent/50",
          )}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
