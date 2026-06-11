"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeGitHubLogin } from "@/lib/auth/github-oauth";
import { useAppStore } from "@/lib/store/app-store";

export function OAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signIn = useAppStore((state) => state.signIn);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) {
      setError("Missing OAuth parameters.");
      return;
    }

    completeGitHubLogin(code, state)
      .then(async (session) => {
        await signIn(session);
        router.replace("/");
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "Sign-in failed.",
        );
      });
  }, [searchParams, signIn, router]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      {error ? (
        <>
          <p className="text-lg font-medium">Sign-in failed</p>
          <p className="max-w-xs text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => router.replace("/login")}>Back to sign in</Button>
        </>
      ) : (
        <>
          <Loader2 aria-hidden className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        </>
      )}
    </main>
  );
}
