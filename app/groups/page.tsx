import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { GroupsView } from "@/components/views/groups-view";

export const metadata: Metadata = { title: "Groups — Ledger" };

export default function GroupsPage() {
  return (
    <AppShell title="Groups">
      <GroupsView />
    </AppShell>
  );
}
