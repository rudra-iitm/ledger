import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ExpensesView } from "@/components/views/expenses-view";

export const metadata: Metadata = { title: "Investment transactions — Ledger" };

export default function InvestmentTransactionsPage() {
  return (
    <AppShell title="Investment transactions">
      <ExpensesView scope="investments" />
    </AppShell>
  );
}
