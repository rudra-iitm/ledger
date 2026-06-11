"use client";

import { useState } from "react";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TIME_PRESETS,
  TIME_PRESET_LABELS,
  type DateRange,
  type TimePreset,
} from "@/lib/domain/time-ranges";
import { cn } from "@/lib/utils";

export interface TimeFilterValue {
  preset: TimePreset;
  custom: DateRange;
}

export function TimeRangePicker({
  value,
  onChange,
}: {
  value: TimeFilterValue;
  onChange: (value: TimeFilterValue) => void;
}) {
  const [open, setOpen] = useState(false);

  const label =
    value.preset === "custom" && value.custom.start
      ? `${value.custom.start} → ${value.custom.end ?? "…"}`
      : TIME_PRESET_LABELS[value.preset];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[13px] font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
        <CalendarRange aria-hidden className="size-3.5 text-muted-foreground" />
        {label}
        <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="flex flex-col">
          {TIME_PRESETS.filter((preset) => preset !== "custom").map((preset) => {
            const selected = value.preset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onChange({ preset, custom: value.custom });
                  setOpen(false);
                }}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
              >
                {TIME_PRESET_LABELS[preset]}
                {selected && <Check aria-hidden className="size-4" />}
              </button>
            );
          })}
          <div
            className={cn(
              "mt-1 flex flex-col gap-2 rounded-lg border border-border p-3",
              value.preset === "custom" && "border-ring",
            )}
          >
            <Label className="text-[13px]">Custom range</Label>
            <Input
              type="date"
              aria-label="Start date"
              value={value.custom.start ?? ""}
              onChange={(event) =>
                onChange({
                  preset: "custom",
                  custom: { ...value.custom, start: event.target.value || null },
                })
              }
            />
            <Input
              type="date"
              aria-label="End date"
              value={value.custom.end ?? ""}
              onChange={(event) =>
                onChange({
                  preset: "custom",
                  custom: { ...value.custom, end: event.target.value || null },
                })
              }
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
