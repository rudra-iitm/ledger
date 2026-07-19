import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CaptureView } from "@/components/views/capture-view";

export const metadata: Metadata = { title: "Capture — Ledger" };

export default function CapturePage() {
  return (
    <AppShell title="Capture">
      <Suspense>
        <CaptureView />
      </Suspense>
    </AppShell>
  );
}
