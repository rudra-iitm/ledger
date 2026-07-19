"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/lib/store/app-store";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAppStore((state) => state.status);
  const retryInitialize = useAppStore((state) => state.retryInitialize);
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "offline") return;
    const onOnline = () => void retryInitialize();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [status, retryInitialize]);

  if (status === "ready") return <>{children}</>;

  if (status === "offline") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary/60">
          <CloudOff aria-hidden className="size-6 text-muted-foreground" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-base font-medium">Can&apos;t reach your data</p>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            You seem to be offline, or GitHub is unreachable. You&apos;re still
            signed in — nothing was lost.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void retryInitialize()}>
          <RefreshCw aria-hidden />
          Try again
        </Button>
      </main>
    );
  }

  return (
    <main
      aria-busy
      aria-label="Loading"
      className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 pt-16"
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </main>
  );
}
