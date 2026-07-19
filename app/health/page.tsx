import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { HealthView } from "@/components/views/health-view";

export const metadata: Metadata = { title: "Financial health — Ledger" };

export default function HealthPage() {
  return (
    <AppShell title="Financial health">
      <HealthView />
    </AppShell>
  );
}
