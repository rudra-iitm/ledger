"use client";

import { useState } from "react";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateField } from "@/components/fields/date-field";
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
      <PopoverContent
        align="start"
        className="w-64 divide-y divide-border/60 overflow-hidden p-0"
      >
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
              className={cn(
                "flex h-12 w-full items-center justify-between px-4 text-left text-[15px] outline-none transition-colors hover:bg-accent/70 focus-visible:bg-accent/70 active:bg-accent/70",
                selected && "font-medium",
              )}
            >
              {TIME_PRESET_LABELS[preset]}
              {selected && <Check aria-hidden className="size-4.5" />}
            </button>
          );
        })}
        <div className="flex flex-col gap-2.5 bg-background/40 p-4">
          <Label
            className={cn(
              "text-[13px]",
              value.preset === "custom" && "text-foreground",
            )}
          >
            Custom range
          </Label>
          <DateField
            ariaLabel="Start date"
            placeholder="Start date"
            value={value.custom.start}
            onChange={(start) =>
              onChange({
                preset: "custom",
                custom: { ...value.custom, start: start || null },
              })
            }
          />
          <DateField
            ariaLabel="End date"
            placeholder="End date"
            value={value.custom.end}
            onChange={(end) =>
              onChange({
                preset: "custom",
                custom: { ...value.custom, end: end || null },
              })
            }
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
