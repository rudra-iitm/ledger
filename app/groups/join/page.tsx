import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { JoinGroupView } from "./client";

export const metadata: Metadata = { title: "Join group — Ledger" };

export default function JoinGroupPage() {
  return (
    <AppShell title="Join group">
      <Suspense>
        <JoinGroupView />
      </Suspense>
    </AppShell>
  );
}
