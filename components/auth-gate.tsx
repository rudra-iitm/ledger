"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/lib/store/app-store";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAppStore((state) => state.status);
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "ready") return <>{children}</>;

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
