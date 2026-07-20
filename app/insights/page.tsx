import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { InsightsView } from "@/components/views/insights-view";

export const metadata: Metadata = { title: "Insights — Ledger" };

export default function InsightsPage() {
  return (
    <AppShell title="Insights">
      <InsightsView />
    </AppShell>
  );
}
