import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/views/dashboard-view";

export const metadata: Metadata = { title: "Ledger" };

export default function DashboardPage() {
  return (
    <AppShell title="Ledger">
      <DashboardView />
    </AppShell>
  );
}
