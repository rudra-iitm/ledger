import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ExpensesPageClient } from "./client";

export const metadata: Metadata = { title: "Expenses — Ledger" };

export default function ExpensesPage() {
  return (
    <AppShell title="Expenses">
      <Suspense>
        <ExpensesPageClient />
      </Suspense>
    </AppShell>
  );
}
