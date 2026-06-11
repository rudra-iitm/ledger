import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { RecurringView } from "@/components/views/recurring-view";

export const metadata: Metadata = { title: "Recurring — Ledger" };

export default function RecurringPage() {
  return (
    <AppShell title="Recurring">
      <RecurringView />
    </AppShell>
  );
}
