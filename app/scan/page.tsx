import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ScanView } from "@/components/views/scan-view";

export const metadata: Metadata = { title: "Scan — Ledger" };

export default function ScanPage() {
  return (
    <AppShell title="Scan a document">
      <ScanView />
    </AppShell>
  );
}
