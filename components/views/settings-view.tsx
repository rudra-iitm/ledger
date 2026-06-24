"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronRight,
  Download,
  LineChart,
  LogOut,
  Smartphone,
  Target,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { BackupParseError } from "@/lib/export/backup";
import { downloadJson } from "@/lib/export/files";
import { backupFilename } from "@/lib/export/backup";
import { upcomingEvents } from "@/lib/domain/upcoming";
import {
  disableReminders,
  enableReminders,
  pushSupported,
  remindersEnabled,
} from "@/lib/pwa/reminders";
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
  const exportBackup = useAppStore((state) => state.exportBackup);
  const importBackup = useAppStore((state) => state.importBackup);
  const recurring = useAppStore((state) => state.data.recurring);
  const subscriptions = useAppStore((state) => state.data.subscriptions);
  const recurringInvestments = useAppStore(
    (state) => state.data.recurringInvestments,
  );
  const sheets = useSheets();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [remindersSupported, setRemindersSupported] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);
  const [remindersBusy, setRemindersBusy] = useState(false);

  useEffect(() => {
    setRemindersSupported(pushSupported());
    void remindersEnabled().then(setRemindersOn);
  }, []);

  const toggleReminders = async () => {
    setRemindersBusy(true);
    try {
      if (remindersOn) {
        await disableReminders();
        setRemindersOn(false);
        toast.success("Reminders turned off");
      } else {
        const events = upcomingEvents({
          recurring,
          subscriptions,
          recurringInvestments,
          accounts,
        });
        await enableReminders(events);
        setRemindersOn(true);
        toast.success("Reminders turned on");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't update reminders",
      );
    } finally {
      setRemindersBusy(false);
    }
  };

  const handleExport = () => {
    downloadJson(backupFilename(), exportBackup());
    toast.success("Backup downloaded");
  };

  const handleImportFile = async (file: File) => {
    if (
      !window.confirm(
        "Importing replaces all current data with the backup's contents. Continue?",
      )
    ) {
      return;
    }
    setImporting(true);
    try {
      await importBackup(await file.text());
      toast.success("Backup restored");
    } catch (error) {
      toast.error(
        error instanceof BackupParseError
          ? error.message
          : "Couldn't restore that backup",
      );
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-label="Account"
        className="flex items-center gap-4 rounded-2xl border border-border bg-card shadow-soft px-4 py-4"
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
          className="flex items-center justify-between rounded-2xl border border-border bg-card shadow-soft px-4 py-4 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
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
          className="flex items-center justify-between rounded-2xl border border-border bg-card shadow-soft px-4 py-4 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
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

        <div className="flex items-center justify-between rounded-2xl border border-border bg-card shadow-soft px-4 py-3">
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

      <section aria-label="Display" className="flex flex-col gap-3">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">
          Display
        </h2>
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card shadow-soft px-4 py-4">
          <span className="flex items-center gap-3">
            <LineChart aria-hidden className="size-5 text-muted-foreground" />
            <span className="flex flex-col">
              <span className="text-[15px] font-medium">
                Show investments in Expenses
              </span>
              <span className="text-[13px] text-muted-foreground">
                Include investment buys in Expenses &amp; Recent activity
              </span>
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.showInvestmentsInExpenses}
            aria-label="Show investments in Expenses and Recent activity"
            onClick={() =>
              updateSettings({
                showInvestmentsInExpenses: !settings.showInvestmentsInExpenses,
              })
            }
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              settings.showInvestmentsInExpenses ? "bg-emerald-500" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none block size-5 rounded-full bg-background shadow-sm transition-transform ${
                settings.showInvestmentsInExpenses
                  ? "translate-x-[22px]"
                  : "translate-x-0.5"
              }`}
            />
          </button>
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

      {remindersSupported && (
        <section aria-label="Reminders" className="flex flex-col gap-3">
          <h2 className="px-1 text-sm font-medium text-muted-foreground">
            Reminders
          </h2>
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card shadow-soft px-4 py-4">
            <span className="flex items-center gap-3">
              <Bell aria-hidden className="size-5 text-muted-foreground" />
              <span className="flex flex-col">
                <span className="text-[15px] font-medium">Bill reminders</span>
                <span className="text-[13px] text-muted-foreground">
                  Get a push for bills &amp; card dues
                </span>
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={remindersOn}
              aria-label="Bill reminders"
              disabled={remindersBusy}
              onClick={() => void toggleReminders()}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 ${
                remindersOn ? "bg-emerald-500" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none block size-5 rounded-full bg-background shadow-sm transition-transform ${
                  remindersOn ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </section>
      )}

      <section aria-label="Data" className="flex flex-col gap-3">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">Data</h2>
        <p className="px-1 text-[13px] text-muted-foreground">
          {session?.provider === "github"
            ? "Your data lives in your private GitHub repo. Download a snapshot or restore one anytime."
            : "Your data stays on this device. Download a backup to keep it safe or move it elsewhere."}
        </p>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center justify-between rounded-2xl border border-border bg-card shadow-soft px-4 py-4 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-3">
            <Download aria-hidden className="size-5 text-muted-foreground" />
            <span className="text-[15px] font-medium">Export backup</span>
          </span>
          <span className="text-[13px] text-muted-foreground">.json</span>
        </button>
        <button
          type="button"
          disabled={importing}
          onClick={() => fileInput.current?.click()}
          className="flex items-center justify-between rounded-2xl border border-border bg-card shadow-soft px-4 py-4 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <span className="flex items-center gap-3">
            <Upload aria-hidden className="size-5 text-muted-foreground" />
            <span className="text-[15px] font-medium">
              {importing ? "Restoring…" : "Import backup"}
            </span>
          </span>
          <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImportFile(file);
          }}
        />
      </section>

      <Button variant="destructive" size="lg" onClick={() => signOut()}>
        <LogOut aria-hidden />
        Sign out
      </Button>
    </div>
  );
}
