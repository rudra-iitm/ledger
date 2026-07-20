import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CopilotView } from "@/components/views/copilot-view";

export const metadata: Metadata = { title: "Copilot — Ledger" };

export default function CopilotPage() {
  return (
    <AppShell title="Copilot">
      <CopilotView />
    </AppShell>
  );
}
