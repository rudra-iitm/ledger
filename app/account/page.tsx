import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AccountDetailView } from "@/components/views/account-detail-view";

export const metadata: Metadata = { title: "Account — Ledger" };

export default function AccountPage() {
  return (
    <AppShell title="Account">
      <Suspense>
        <AccountDetailView />
      </Suspense>
    </AppShell>
  );
}
