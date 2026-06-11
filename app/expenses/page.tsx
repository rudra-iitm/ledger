import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ExpensesView } from "@/components/views/expenses-view";

export const metadata: Metadata = { title: "Expenses — Ledger" };

export default function ExpensesPage() {
  return (
    <AppShell title="Expenses">
      <ExpensesView />
    </AppShell>
  );
}
