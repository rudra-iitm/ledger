import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AccountsView } from "@/components/views/accounts-view";

export const metadata: Metadata = { title: "Accounts — Ledger" };

export default function AccountsPage() {
  return (
    <AppShell title="Accounts">
      <AccountsView />
    </AppShell>
  );
}
