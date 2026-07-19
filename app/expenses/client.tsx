"use client";

import { useSearchParams } from "next/navigation";
import { ExpensesView } from "@/components/views/expenses-view";
import { TIME_PRESETS, type TimePreset } from "@/lib/domain/time-ranges";
import { CATEGORIES, type Category } from "@/lib/domain/types";

export function ExpensesPageClient() {
  const params = useSearchParams();
  const rawCategory = params.get("category");
  const rawPreset = params.get("preset");
  const rawQuery = params.get("q") ?? "";
  const initialCategory = CATEGORIES.includes(rawCategory as Category)
    ? (rawCategory as Category)
    : null;
  const initialPreset = TIME_PRESETS.includes(rawPreset as TimePreset)
    ? (rawPreset as TimePreset)
    : null;
  // Remount when the deep-linked filters change so they apply cleanly.
  return (
    <ExpensesView
      key={`${rawCategory ?? ""}|${rawPreset ?? ""}|${rawQuery}`}
      initialCategory={initialCategory}
      initialPreset={initialPreset}
      initialQuery={rawQuery}
    />
  );
}
