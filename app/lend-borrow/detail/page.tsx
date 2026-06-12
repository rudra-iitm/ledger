import { Suspense } from "react";
import type { Metadata } from "next";
import { LendBorrowDetailClient } from "./client";

export const metadata: Metadata = { title: "Lend & Borrow Detail — Ledger" };

export default function LendBorrowDetailPage() {
  return (
    <Suspense>
      <LendBorrowDetailClient />
    </Suspense>
  );
}
