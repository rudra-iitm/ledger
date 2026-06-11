import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ReportsView } from "@/components/views/reports-view";

export const metadata: Metadata = { title: "Reports — Ledger" };

export default function ReportsPage() {
  return (
    <AppShell title="Reports">
      <ReportsView />
    </AppShell>
  );
}
