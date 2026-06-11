import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SpaceDetailView } from "@/components/views/space-detail-view";

export const metadata: Metadata = { title: "Space — Ledger" };

export default function SpacePage() {
  return (
    <AppShell title="Space">
      <Suspense>
        <SpaceDetailView />
      </Suspense>
    </AppShell>
  );
}
