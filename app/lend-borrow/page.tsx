import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { LendBorrowView } from "@/components/views/lend-borrow-view";

export const metadata: Metadata = { title: "Lend & Borrow — Ledger" };

export default function LendBorrowPage() {
  return (
    <AppShell title="Lend & Borrow">
      <LendBorrowView />
    </AppShell>
  );
}
