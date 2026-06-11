import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { GroupDetailView } from "@/components/views/group-detail-view";

export const metadata: Metadata = { title: "Group — Ledger" };

export default function GroupPage() {
  return (
    <AppShell title="Group">
      <Suspense>
        <GroupDetailView />
      </Suspense>
    </AppShell>
  );
}
