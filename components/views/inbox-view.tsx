"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Check, FileUp, Inbox, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { CategoryIcon } from "@/components/category-icon";
import { CATEGORIES, type Category, type DraftTransaction } from "@/lib/domain/types";
import { formatDisplayDate } from "@/lib/domain/dates";
import {
  mineRecurring,
  type RecurringSuggestion,
} from "@/lib/domain/ingest/recurrence";
import { detectAnomalies, type FinanceAlert } from "@/lib/domain/anomalies";
import { aiAvailable } from "@/lib/ai/gemini";
import { AiError, generate } from "@/lib/ai/client";
import { buildCategorizePrompt } from "@/lib/ai/prompts";
import { extractJson } from "@/lib/ai/parse";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";
import { BrandIcon } from "@/components/brand-icon";
import { resolveBrand } from "@/lib/brands/registry";

const NONE = "__none__";

function DraftRow({ draft }: { draft: DraftTransaction }) {
  const currency = useAppStore((state) => state.data.settings.currency);
  const accounts = useAppStore((state) => state.data.accounts);
  const updateDraft = useAppStore((state) => state.updateDraft);
  const confirmDraft = useAppStore((state) => state.confirmDraft);
  const rejectDraft = useAppStore((state) => state.rejectDraft);
  const account = accounts.find((item) => item.id === draft.accountId);
  const isCredit = draft.direction === "credit";

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-soft">
      <CategoryIcon
        category={isCredit ? "Other" : draft.suggestedCategory}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] font-medium">
          {draft.description}
        </span>
        <span className="truncate text-[12px] text-muted-foreground">
          {formatDisplayDate(draft.date)}
          {account ? ` · ${account.name}` : ""}
          {draft.channel && draft.channel !== "other"
            ? ` · ${draft.channel.toUpperCase()}`
            : ""}
        </span>
        {draft.suggestedType === "expense" && (
          <Select
            value={draft.suggestedCategory}
            onValueChange={(value) =>
              updateDraft(draft.id, { suggestedCategory: value as Category })
            }
          >
            <SelectTrigger className="h-8 w-fit gap-1 rounded-full px-3 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {draft.suggestedType !== "expense" && (
          <Badge variant="outline" className="w-fit text-[11px]">
            {draft.suggestedType === "income"
              ? (draft.suggestedIncomeCategory ?? "Income")
              : draft.suggestedType === "transfer"
                ? "Transfer"
                : "Card payment"}
          </Badge>
        )}
      </div>
      <span
        className={
          "text-[15px] font-semibold tabular-nums " +
          (isCredit ? "text-positive" : "")
        }
      >
        {isCredit ? "+" : "−"}
        {formatMoney(draft.amount, currency)}
      </span>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          aria-label="Confirm"
          onClick={() => confirmDraft(draft.id)}
          className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none transition-transform ease-spring focus-visible:ring-2 focus-visible:ring-ring active:scale-90"
        >
          <Check aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Reject"
          onClick={() => rejectDraft(draft.id)}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </li>
  );
}

function ReviewCard({ draft }: { draft: DraftTransaction }) {
  const currency = useAppStore((state) => state.data.settings.currency);
  const expenses = useAppStore((state) => state.data.expenses);
  const resolveDraftDuplicate = useAppStore(
    (state) => state.resolveDraftDuplicate,
  );
  const match = expenses.find((item) => item.id === draft.matchExpenseId);

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-card px-4 py-3 shadow-soft">
      <p className="text-[12px] font-medium uppercase tracking-wide text-amber-400">
        Possible duplicate
        {draft.matchScore !== undefined
          ? ` · ${Math.round(draft.matchScore * 100)}% match`
          : ""}
      </p>
      <div className="grid grid-cols-2 gap-3 text-[13px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase text-muted-foreground">
            Statement
          </span>
          <span className="truncate font-medium">{draft.description}</span>
          <span className="text-muted-foreground">
            {formatDisplayDate(draft.date)}
          </span>
          <span className="font-semibold tabular-nums">
            {formatMoney(draft.amount, currency)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase text-muted-foreground">
            In your ledger
          </span>
          {match ? (
            <>
              <span className="truncate font-medium">{match.description}</span>
              <span className="text-muted-foreground">
                {formatDisplayDate(match.date)}
              </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(match.amount, currency)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Entry no longer exists</span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          onClick={() => resolveDraftDuplicate(draft.id, "merge")}
          disabled={!match}
        >
          Same — merge
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => resolveDraftDuplicate(draft.id, "keep")}
        >
          Different — keep both
        </Button>
      </div>
    </li>
  );
}

function AlertCard({ alert }: { alert: FinanceAlert }) {
  const dismissAlert = useAppStore((state) => state.dismissAlert);
  return (
    <li
      className={
        "flex items-start gap-3 rounded-2xl border px-4 py-3 " +
        (alert.severity === "warn"
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-border bg-card shadow-soft")
      }
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium">{alert.title}</span>
        <span className="text-[12px] leading-relaxed text-muted-foreground">
          {alert.detail}
        </span>
      </div>
      <button
        type="button"
        aria-label="Dismiss alert"
        onClick={() => dismissAlert(alert.key)}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X aria-hidden className="size-4" />
      </button>
    </li>
  );
}

const CADENCE_LABELS: Record<RecurringSuggestion["cadence"], string> = {
  weekly: "weekly",
  monthly: "monthly",
  quarterly: "quarterly",
  yearly: "yearly",
};

function SuggestionCard({ suggestion }: { suggestion: RecurringSuggestion }) {
  const currency = useAppStore((state) => state.data.settings.currency);
  const trackSuggestion = useAppStore((state) => state.trackSuggestion);
  const dismissSuggestion = useAppStore((state) => state.dismissSuggestion);

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
      <BrandIcon
        brand={resolveBrand(suggestion.merchant)}
        fallbackCategory={suggestion.category}
        size="sm"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-medium">
          {suggestion.merchant}
        </span>
        <span className="text-[12px] text-muted-foreground">
          {suggestion.kind === "emi"
            ? "Looks like an EMI"
            : suggestion.kind === "subscription"
              ? "Looks like a subscription"
              : "Repeating bill"}{" "}
          · {formatMoney(suggestion.averageAmount, currency)}{" "}
          {CADENCE_LABELS[suggestion.cadence]} · seen {suggestion.occurrences}×
          · next ~{formatDisplayDate(suggestion.nextExpected)}
        </span>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            trackSuggestion(suggestion);
            toast.success(`Tracking ${suggestion.merchant}`);
          }}
        >
          Track
        </Button>
        <button
          type="button"
          aria-label="Dismiss suggestion"
          onClick={() => dismissSuggestion(suggestion.key)}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </li>
  );
}

function RulesTab() {
  const rules = useAppStore((state) => state.data.rules);
  const addRule = useAppStore((state) => state.addRule);
  const deleteRule = useAppStore((state) => state.deleteRule);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string>(NONE);
  const [renameTo, setRenameTo] = useState("");
  const [tags, setTags] = useState("");

  const reset = () => {
    setName("");
    setText("");
    setCategory(NONE);
    setRenameTo("");
    setTags("");
  };

  const save = () => {
    if (!text.trim()) {
      toast.error("Add the text the rule should match.");
      return;
    }
    addRule({
      name: name.trim() || `Contains “${text.trim()}”`,
      enabled: true,
      match: { text: text.trim() },
      actions: {
        category: category === NONE ? undefined : (category as Category),
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        renameTo: renameTo.trim() || undefined,
      },
    });
    toast.success("Rule added");
    reset();
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          Rules run on every imported transaction, first match wins.
        </p>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Plus aria-hidden />
          New rule
        </Button>
      </div>
      {rules.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No rules yet"
          description="Create rules like “anything containing BLINKIT is Food” and imports will categorize themselves."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium">
                  {rule.name}
                </span>
                <span className="truncate text-[12px] text-muted-foreground">
                  {[
                    rule.match.text ? `contains “${rule.match.text}”` : null,
                    rule.actions.category ? `→ ${rule.actions.category}` : null,
                    rule.actions.renameTo
                      ? `→ “${rule.actions.renameTo}”`
                      : null,
                    rule.actions.tags.length
                      ? `#${rule.actions.tags.join(" #")}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <button
                type="button"
                aria-label="Delete rule"
                onClick={() => deleteRule(rule.id)}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New rule</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-text">When description contains</Label>
              <Input
                id="rule-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="e.g. BLINKIT"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Set category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Keep suggestion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Keep suggestion</SelectItem>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-rename">Rename to (optional)</Label>
              <Input
                id="rule-rename"
                value={renameTo}
                onChange={(event) => setRenameTo(event.target.value)}
                placeholder="e.g. Groceries — Blinkit"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-tags">Add tags (comma separated)</Label>
              <Input
                id="rule-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="groceries, home"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-name">Rule name (optional)</Label>
              <Input
                id="rule-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <Button onClick={save}>Save rule</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function InboxView() {
  const drafts = useAppStore((state) => state.data.inbox.drafts);
  const batches = useAppStore((state) => state.data.inbox.batches);
  const dismissed = useAppStore(
    (state) => state.data.inbox.dismissedSuggestions,
  );
  const dismissedAlerts = useAppStore(
    (state) => state.data.inbox.dismissedAlerts,
  );
  const currency = useAppStore((state) => state.data.settings.currency);
  const expenses = useAppStore((state) => state.data.expenses);
  const subscriptions = useAppStore((state) => state.data.subscriptions);
  const recurringItems = useAppStore((state) => state.data.recurring);
  const confirmPendingDrafts = useAppStore(
    (state) => state.confirmPendingDrafts,
  );

  const review = useMemo(
    () => drafts.filter((draft) => draft.status === "review"),
    [drafts],
  );
  const pending = useMemo(
    () => drafts.filter((draft) => draft.status === "pending"),
    [drafts],
  );
  const suggestions = useMemo(
    () =>
      mineRecurring(expenses, {
        subscriptions,
        recurring: recurringItems,
        dismissed,
      }),
    [expenses, subscriptions, recurringItems, dismissed],
  );
  const alerts = useMemo(
    () =>
      detectAnomalies({
        expenses,
        subscriptions,
        currency,
        dismissed: dismissedAlerts,
      }),
    [expenses, subscriptions, currency, dismissedAlerts],
  );
  const lastBatch = batches[0];

  const updateDraft = useAppStore((state) => state.updateDraft);
  const [aiOn, setAiOn] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  useEffect(() => {
    setAiOn(aiAvailable());
  }, []);

  // Drafts the rules/brand registry couldn't place — AI's cleanup batch.
  const uncategorized = useMemo(
    () =>
      pending.filter(
        (draft) =>
          draft.suggestedType === "expense" &&
          draft.suggestedCategory === "Other",
      ),
    [pending],
  );

  const categorizeWithAi = async () => {
    setCategorizing(true);
    try {
      const batch = uncategorized.slice(0, 40);
      const text = await generate(
        buildCategorizePrompt(batch.map((draft) => draft.description)),
        {
          feature: "categorize-drafts",
          schema: {
            type: "ARRAY",
            items: { type: "STRING", enum: [...CATEGORIES] },
          },
        },
      );
      const parsed = extractJson<string[]>(text);
      if (!parsed || !Array.isArray(parsed)) {
        toast.error("Gemini's answer didn't parse — try again.");
        return;
      }
      let applied = 0;
      batch.forEach((draft, index) => {
        const category = parsed[index];
        if (
          typeof category === "string" &&
          category !== "Other" &&
          (CATEGORIES as readonly string[]).includes(category)
        ) {
          updateDraft(draft.id, {
            suggestedCategory: category as Category,
          });
          applied += 1;
        }
      });
      toast.success(
        applied > 0
          ? `Categorized ${applied} of ${batch.length} drafts — review before confirming`
          : "Gemini couldn't improve on these — they stay as Other",
      );
    } catch (error) {
      toast.error(
        error instanceof AiError ? error.message : "Categorization failed.",
      );
    } finally {
      setCategorizing(false);
    }
  };

  const confirmAll = () => {
    const count = confirmPendingDrafts();
    if (count > 0) toast.success(`${count} transactions added to your ledger`);
  };

  return (
    <Tabs defaultValue="review" className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="review">
            Review{drafts.length > 0 ? ` (${drafts.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>
        <Button asChild size="sm" variant="secondary">
          <Link href="/import">
            <FileUp aria-hidden />
            Import
          </Link>
        </Button>
      </div>

      <TabsContent value="review" className="flex flex-col gap-5">
        {alerts.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
              Heads up ({alerts.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {alerts.map((alert) => (
                <AlertCard key={alert.key} alert={alert} />
              ))}
            </ul>
          </section>
        )}
        {suggestions.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
              Detected recurring payments ({suggestions.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {suggestions.map((suggestion) => (
                <SuggestionCard key={suggestion.key} suggestion={suggestion} />
              ))}
            </ul>
          </section>
        )}
        {drafts.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Inbox zero"
            description="Import a bank statement and new transactions will land here for a one-tap review — no typing."
            action={
              <Button asChild variant="secondary">
                <Link href="/import">
                  <FileUp aria-hidden />
                  Import statement
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            {lastBatch && (
              <p className="text-[13px] text-muted-foreground">
                Last import: {lastBatch.fileName} — {lastBatch.rowCount} rows,{" "}
                {lastBatch.autoMergedCount} auto-matched,{" "}
                {lastBatch.duplicateCount} already imported.
              </p>
            )}
            {review.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                  Needs review ({review.length})
                </h2>
                <ul className="flex flex-col gap-2">
                  {review.map((draft) => (
                    <ReviewCard key={draft.id} draft={draft} />
                  ))}
                </ul>
              </section>
            )}
            {pending.length > 0 && (
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                    Ready to add ({pending.length})
                  </h2>
                  <div className="flex items-center gap-1.5">
                    {aiOn && uncategorized.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={categorizing}
                        onClick={() => void categorizeWithAi()}
                      >
                        <Bot aria-hidden />
                        {categorizing
                          ? "Categorizing…"
                          : `Categorize ${uncategorized.length} with AI`}
                      </Button>
                    )}
                    <Button size="sm" onClick={confirmAll}>
                      <Check aria-hidden />
                      Confirm all
                    </Button>
                  </div>
                </div>
                <ul className="flex flex-col gap-2">
                  {pending.map((draft) => (
                    <DraftRow key={draft.id} draft={draft} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="rules">
        <RulesTab />
      </TabsContent>
    </Tabs>
  );
}
