import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ImportView } from "@/components/views/import-view";

export const metadata: Metadata = { title: "Import statement — Ledger" };

export default function ImportPage() {
  return (
    <AppShell title="Import statement">
      <ImportView />
    </AppShell>
  );
}
