import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ReviewsView } from "@/components/views/reviews-view";

export const metadata: Metadata = { title: "Reviews — Ledger" };

export default function ReviewsPage() {
  return (
    <AppShell title="Monthly Review">
      <ReviewsView />
    </AppShell>
  );
}
