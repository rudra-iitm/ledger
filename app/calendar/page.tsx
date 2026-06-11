import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CalendarView } from "@/components/views/calendar-view";

export const metadata: Metadata = { title: "Calendar — Ledger" };

export default function CalendarPage() {
  return (
    <AppShell title="Calendar">
      <CalendarView />
    </AppShell>
  );
}
