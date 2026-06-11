"use client";

import { ChevronRight, LogOut, Smartphone, Target } from "lucide-react";
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
  const updateSettings = useAppStore((state) => state.updateSettings);
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
          <span className="text-sm text-muted-foreground">
            {session?.provider === "github"
              ? "Synced to your private GitHub repository"
              : session?.provider === "google"
                ? "Google account · data stays on this device"
                : "Data stays on this device"}
          </span>
        </span>
      </section>

      <section aria-label="Preferences" className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => sheets.openBudget()}
          className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-3">
            <Target aria-hidden className="size-5 text-muted-foreground" />
            <span className="text-base font-medium">Monthly budget</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {monthlyBudget > 0
              ? formatMoney(monthlyBudget, settings.currency)
              : "Not set"}
            <ChevronRight aria-hidden className="size-4" />
          </span>
        </button>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
          <Label htmlFor="currency" className="text-base font-medium text-foreground">
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

      <Button variant="destructive" size="lg" onClick={() => signOut()}>
        <LogOut aria-hidden />
        Sign out
      </Button>
    </div>
  );
}
