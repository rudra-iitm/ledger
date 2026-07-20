"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ListFilter, Search, Users } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { interpretSearch } from "@/lib/domain/smart-search";
import { aiAvailable } from "@/lib/ai/gemini";
import { generate } from "@/lib/ai/client";
import { buildFilterPrompt } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/parse";
import { TIME_PRESETS, type TimePreset } from "@/lib/domain/time-ranges";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CATEGORIES, type Category } from "@/lib/domain/types";
import { filterExpenses } from "@/lib/domain/analytics";
import { formatDisplayDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { useSheets } from "./sheet-context";

export function SearchSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const expenses = useAppStore((state) => state.data.expenses);
  const groups = useAppStore((state) => state.data.groups);
  const currency = useAppStore((state) => state.data.settings.currency);
  const sheets = useSheets();
  const [query, setQuery] = useState("");

  const trimmed = query.trim().toLowerCase();

  const matchingExpenses = useMemo(() => {
    if (!trimmed) return [];
    return filterExpenses(expenses, { query: trimmed })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
  }, [expenses, trimmed]);

  const matchingCategories = useMemo<Category[]>(() => {
    if (!trimmed) return [];
    return CATEGORIES.filter((category) =>
      category.toLowerCase().includes(trimmed),
    );
  }, [trimmed]);

  const matchingGroups = useMemo(() => {
    if (!trimmed) return [];
    return groups.filter((group) => group.name.toLowerCase().includes(trimmed));
  }, [groups, trimmed]);

  const smartQuery = useMemo(() => interpretSearch(query), [query]);
  const [aiOn, setAiOn] = useState(false);
  /** Held only to keep concurrent fallbacks from overlapping. */
  const [, setAsking] = useState(false);
  /** Filters the model compiled from a question the grammar couldn't parse. */
  const [aiFilters, setAiFilters] = useState<{
    category: Category | null;
    preset: TimePreset | null;
    query: string;
  } | null>(null);

  useEffect(() => {
    setAiOn(aiAvailable());
  }, []);

  const openFilters = (filters: {
    category?: Category | null;
    preset?: TimePreset | null;
    query?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.preset) params.set("preset", filters.preset);
    if (filters.query) params.set("q", filters.query);
    close();
    router.push(`/expenses?${params.toString()}`);
  };

  const openSmartQuery = () => {
    if (!smartQuery) return;
    openFilters(smartQuery);
  };

  /**
   * AI fallback when the deterministic interpreter finds no structure.
   *
   * Runs itself. The old version of this was a row labelled "Ask AI: <query>"
   * that the user had to notice and tap — which asked them to know which of
   * their own questions our grammar could parse. Now the grammar tries first,
   * and when it comes up empty this fires on a debounce and produces the same
   * "Show expenses: …" row the deterministic path produces. The user sees one
   * kind of answer, not two, and never learns the word "fallback".
   *
   * Only the question text is sent — never any ledger data.
   */
  const askAi = async () => {
    setAsking(true);
    try {
      const text = await generate(buildFilterPrompt(query), {
        feature: "search-filter",
        schema: {
          type: "OBJECT",
          properties: {
            category: {
              type: "STRING",
              enum: [...CATEGORIES],
              nullable: true,
            },
            preset: { type: "STRING", nullable: true },
            query: { type: "STRING" },
          },
          required: ["query"],
        },
      });
      const parsed = extractJson<{
        category?: string | null;
        preset?: string | null;
        query?: string;
      }>(text);
      if (!parsed) return;
      const category = CATEGORIES.includes(parsed.category as Category)
        ? (parsed.category as Category)
        : null;
      const preset = TIME_PRESETS.includes(parsed.preset as TimePreset)
        ? (parsed.preset as TimePreset)
        : null;
      if (!category && !preset && !parsed.query) return;
      setAiFilters({ category, preset, query: parsed.query ?? "" });
    } catch {
      // Silent. The user typed a search, not a request for a model call —
      // a failure here just means the sheet shows what it already had.
    } finally {
      setAsking(false);
    }
  };

  /**
   * Fire the fallback when the local search has nothing and the query reads
   * like a question. Debounced past typing speed so a word-by-word query
   * costs one call, not six.
   */
  useEffect(() => {
    setAiFilters(null);
    if (!open || !aiOn || smartQuery) return;
    if (trimmed.split(/\s+/).filter(Boolean).length < 2) return;
    if (matchingExpenses.length > 0 || matchingCategories.length > 0) return;

    const timer = window.setTimeout(() => void askAi(), 600);
    return () => window.clearTimeout(timer);
    // askAi closes over `query` only, which `trimmed` already tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aiOn, smartQuery, trimmed, matchingExpenses.length, matchingCategories.length]);

  const noResults =
    trimmed.length > 0 &&
    matchingExpenses.length === 0 &&
    matchingCategories.length === 0 &&
    matchingGroups.length === 0;

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && close()}>
      <SheetContent className="max-h-[88dvh]">
        <SheetHeader>
          <SheetTitle>Search</SheetTitle>
        </SheetHeader>
        <div className="flex items-center gap-2 rounded-xl border border-input bg-card pl-4 pr-2 transition-[border-color,box-shadow,background-color] duration-200 focus-within:border-ring/60 focus-within:bg-accent/30 focus-within:ring-4 focus-within:ring-ring/15">
          <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            aria-label="Search everything"
            placeholder="Expenses, categories, tags, groups"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-4 flex flex-col gap-5">
          {smartQuery && (
            <button
              type="button"
              onClick={openSmartQuery}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-soft outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ListFilter aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[14px] font-medium">
                  Show expenses: {smartQuery.label}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  Opens the list with these filters applied
                </span>
              </span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
          )}
          {/*
            Same row, same words, whether the grammar or the model produced
            the filters. The user asked a question and got an answer; which
            engine understood it is our problem, not theirs.
          */}
          {!smartQuery && aiFilters && (
            <button
              type="button"
              onClick={() => openFilters(aiFilters)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-soft outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ListFilter aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[14px] font-medium">
                  Show expenses:{" "}
                  {[aiFilters.category, aiFilters.preset, aiFilters.query]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  Opens the list with these filters applied
                </span>
              </span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
          )}
          {matchingExpenses.length > 0 && (
            <section>
              <h3 className="mb-1 px-1 text-[13px] font-medium text-muted-foreground">
                Expenses
              </h3>
              <ul className="-mx-2 flex flex-col">
                {matchingExpenses.map((expense) => (
                  <li key={expense.id}>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        sheets.openExpense(expense);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <CategoryIcon category={expense.category} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-medium">
                          {expense.description}
                        </span>
                        <span className="text-[13px] text-muted-foreground">
                          {expense.category} · {formatDisplayDate(expense.date)}
                        </span>
                      </span>
                      <span className="text-[15px] font-semibold tabular-nums">
                        {formatMoney(expense.amount, currency)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {matchingCategories.length > 0 && (
            <section>
              <h3 className="mb-1 px-1 text-[13px] font-medium text-muted-foreground">
                Categories
              </h3>
              <div className="flex flex-wrap gap-2">
                {matchingCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      close();
                      router.push(
                        `/expenses?category=${encodeURIComponent(category)}`,
                      );
                    }}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {category}
                  </button>
                ))}
              </div>
            </section>
          )}

          {matchingGroups.length > 0 && (
            <section>
              <h3 className="mb-1 px-1 text-[13px] font-medium text-muted-foreground">
                Groups
              </h3>
              <ul className="flex flex-col gap-2">
                {matchingGroups.map((group) => (
                  <li key={group.id}>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        router.push(`/group/?id=${group.id}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card shadow-soft px-3 py-3 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Users aria-hidden className="size-5 text-muted-foreground" />
                      <span className="text-[15px] font-medium">{group.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {noResults && (
            <p className="px-1 py-8 text-center text-sm text-muted-foreground">
              No matches for &ldquo;{query.trim()}&rdquo;
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
