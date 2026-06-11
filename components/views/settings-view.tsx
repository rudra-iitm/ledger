"use client";

import Link from "next/link";
import {
  ChevronRight,
  LogOut,
  Smartphone,
  Target,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { GitHubIcon } from "@/components/icons";
import { useSheets } from "@/components/sheets/sheet-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";

const CURRENCIES = ["₹", "$", "€", "£"];

export function SettingsView() {
  const session = useAppStore((state) => state.session);
  const settings = useAppStore((state) => state.data.settings);
  const monthlyBudget = useAppStore((state) => state.data.budgets.monthlyBudget);
  const accounts = useAppStore((state) => state.data.accounts);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const deleteTag = useAppStore((state) => state.deleteTag);
  const signOut = useAppStore((state) => state.signOut);
  const sheets = useSheets();

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-label="Account"
        className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4"
      >
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-xl border border-border bg-secondary"
        >
          {session?.provider === "github" ? (
            <GitHubIcon className="size-5" />
          ) : (
            <Smartphone className="size-5" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-medium">
            {session?.user.name}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {session?.provider === "github"
              ? "Synced to your private GitHub repository"
              : session?.provider === "google"
                ? "Google account · data on this device"
                : "Data stays on this device"}
          </span>
        </span>
      </section>

      <section aria-label="Manage" className="flex flex-col gap-3">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">Manage</h2>
        <button
          type="button"
          onClick={() => sheets.openBudget()}
          className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-3">
            <Target aria-hidden className="size-5 text-muted-foreground" />
            <span className="text-[15px] font-medium">Budgets</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {monthlyBudget > 0
              ? formatMoney(monthlyBudget, settings.currency)
              : "Not set"}
            <ChevronRight aria-hidden className="size-4" />
          </span>
        </button>

        <Link
          href="/accounts"
          className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-3">
            <Wallet aria-hidden className="size-5 text-muted-foreground" />
            <span className="text-[15px] font-medium">Accounts</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {accounts.filter((account) => !account.archived).length}
            <ChevronRight aria-hidden className="size-4" />
          </span>
        </Link>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
          <Label
            htmlFor="currency"
            className="text-[15px] font-medium text-foreground"
          >
            Currency
          </Label>
          <Select
            value={settings.currency}
            onValueChange={(currency) => updateSettings({ currency })}
          >
            <SelectTrigger id="currency" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {settings.tags.length > 0 && (
        <section aria-label="Tags" className="flex flex-col gap-3">
          <h2 className="px-1 text-sm font-medium text-muted-foreground">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {settings.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[13px] font-medium"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`Delete tag ${tag}`}
                  onClick={() => {
                    deleteTag(tag);
                    toast.success("Tag removed");
                  }}
                  className="text-muted-foreground outline-none transition-colors hover:text-destructive"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        </section>
      )}

      <Button variant="destructive" size="lg" onClick={() => signOut()}>
        <LogOut aria-hidden />
        Sign out
      </Button>
    </div>
  );
}
