import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { InvestmentsView } from "@/components/views/investments-view";

export const metadata: Metadata = { title: "Investments — Ledger" };

export default function InvestmentsPage() {
  return (
    <AppShell title="Investments">
      <InvestmentsView />
    </AppShell>
  );
}
