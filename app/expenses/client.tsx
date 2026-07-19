"use client";

import { useSearchParams } from "next/navigation";
import { ExpensesView } from "@/components/views/expenses-view";
import { CATEGORIES, type Category } from "@/lib/domain/types";

export function ExpensesPageClient() {
  const params = useSearchParams();
  const raw = params.get("category");
  const initialCategory = CATEGORIES.includes(raw as Category)
    ? (raw as Category)
    : null;
  // Remount when the deep-linked category changes so the filter applies.
  return <ExpensesView key={raw ?? "all"} initialCategory={initialCategory} />;
}
