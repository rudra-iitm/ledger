import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AnalyticsView } from "@/components/views/analytics-view";

export const metadata: Metadata = { title: "Analytics — Ledger" };

export default function AnalyticsPage() {
  return (
    <AppShell title="Analytics">
      <AnalyticsView />
    </AppShell>
  );
}
