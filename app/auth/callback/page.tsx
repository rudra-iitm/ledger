import { Suspense } from "react";
import type { Metadata } from "next";
import { OAuthCallback } from "@/components/auth/oauth-callback";

export const metadata: Metadata = { title: "Signing in — Ledger" };

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <OAuthCallback />
    </Suspense>
  );
}
