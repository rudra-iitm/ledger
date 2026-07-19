import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { InboxView } from "@/components/views/inbox-view";

export const metadata: Metadata = { title: "Inbox — Ledger" };

export default function InboxPage() {
  return (
    <AppShell title="Inbox">
      <InboxView />
    </AppShell>
  );
}
