import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SubscriptionsView } from "@/components/views/subscriptions-view";

export const metadata: Metadata = { title: "Subscriptions — Ledger" };

export default function SubscriptionsPage() {
  return (
    <AppShell title="Subscriptions">
      <SubscriptionsView />
    </AppShell>
  );
}
