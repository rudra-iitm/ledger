import { Suspense } from "react";
import type { Metadata } from "next";
import { PersonDetailClient } from "./client";

export const metadata: Metadata = { title: "Person Detail — Ledger" };

export default function PersonDetailPage() {
  return (
    <Suspense>
      <PersonDetailClient />
    </Suspense>
  );
}
