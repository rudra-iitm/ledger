"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { useAppStore } from "@/lib/store/app-store";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const initialize = useAppStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <>
      {children}
      <Toaster
        theme="dark"
        position="top-center"
        style={{ marginTop: "calc(env(safe-area-inset-top, 47px) + 8px)" }}
        toastOptions={{
          style: {
            background: "var(--popover)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            borderRadius: "9999px",
            padding: "12px 20px",
            fontWeight: 500,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          },
        }}
      />
    </>
  );
}
