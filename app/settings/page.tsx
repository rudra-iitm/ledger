import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SettingsView } from "@/components/views/settings-view";

export const metadata: Metadata = { title: "Settings — Ledger" };

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <SettingsView />
    </AppShell>
  );
}
