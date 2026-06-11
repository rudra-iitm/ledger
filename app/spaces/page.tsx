import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SpacesView } from "@/components/views/spaces-view";

export const metadata: Metadata = { title: "Spaces — Ledger" };

export default function SpacesPage() {
  return (
    <AppShell title="Spaces">
      <SpacesView />
    </AppShell>
  );
}
