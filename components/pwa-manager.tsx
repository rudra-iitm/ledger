"use client";

import { useEffect } from "react";
import { upcomingEvents } from "@/lib/domain/upcoming";
import { registerServiceWorker, syncReminders } from "@/lib/pwa/reminders";
import { useAppStore } from "@/lib/store/app-store";

export function PwaManager() {
  const status = useAppStore((state) => state.status);
  const recurring = useAppStore((state) => state.data.recurring);
  const subscriptions = useAppStore((state) => state.data.subscriptions);
  const recurringInvestments = useAppStore(
    (state) => state.data.recurringInvestments,
  );
  const accounts = useAppStore((state) => state.data.accounts);

  useEffect(() => {
    void registerServiceWorker();
  }, []);

  useEffect(() => {
    // Re-flush writes that failed while offline as soon as we're back.
    const onOnline = () => useAppStore.getState().retrySync();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    const events = upcomingEvents({
      recurring,
      subscriptions,
      recurringInvestments,
      accounts,
    });
    void syncReminders(events);
  }, [status, recurring, subscriptions, recurringInvestments, accounts]);

  return null;
}
