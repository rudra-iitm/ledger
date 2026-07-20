"use client";

/**
 * Where the agent is actually plugged in.
 *
 * This is the only place the background runtime touches React, and the only
 * place `lib/ai/agent` is allowed to reach the store — jobs describe what they
 * want done (`AgentActions`) and this provider performs it, so the agent layer
 * stays free of Zustand and stays testable without a renderer.
 *
 * The feed it publishes is the union of two sources that fail independently:
 * computed signals, which are always there, and model signals, which are a
 * bonus. If the key is missing, the network is down, or the daily budget is
 * spent, the user sees a slightly shorter list — never an error, never a
 * spinner, never an empty state where intelligence used to be.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildComputedSignals } from "@/lib/ai/agent/signals";
import { dismissSignal as persistDismissal, readDismissed } from "@/lib/ai/agent/dismissals";
import { allSignals, forgetSignal } from "@/lib/ai/agent/run-ledger";
import { runAgentPass, scheduleAgentPass } from "@/lib/ai/agent/runtime";
import type { AgentActions } from "@/lib/ai/agent/jobs";
import { rankSignals, type Signal } from "@/lib/ai/agent/types";
import { useAppStore } from "@/lib/store/app-store";

interface AgentValue {
  signals: Signal[];
  dismiss: (signal: Signal) => void;
}

const AgentContext = createContext<AgentValue>({ signals: [], dismiss: () => {} });

export function useAgentSignals(): AgentValue {
  return useContext(AgentContext);
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const data = useAppStore((state) => state.data);
  const ready = useAppStore((state) => state.status === "ready");
  const autonomy = useAppStore((state) => state.data.settings.autonomy);
  const updateDraft = useAppStore((state) => state.updateDraft);
  const dismissAlert = useAppStore((state) => state.dismissAlert);

  const [dismissed, setDismissed] = useState<string[]>([]);
  const [modelSignals, setModelSignals] = useState<Signal[]>([]);

  // Read persisted state after mount, not during render: this component is
  // rendered on the server during the static export and localStorage isn't
  // there yet.
  useEffect(() => {
    setDismissed(readDismissed());
    setModelSignals(allSignals());
  }, []);

  // The store's identity changes on every keystroke in a sheet; the agent
  // only ever needs the latest snapshot at the moment it runs.
  const dataRef = useRef(data);
  dataRef.current = data;

  const actions = useMemo<AgentActions>(
    () => ({
      applyCategorySuggestions: (suggestions) => {
        let applied = 0;
        for (const suggestion of suggestions) {
          updateDraft(suggestion.draftId, { suggestedCategory: suggestion.category });
          applied += 1;
        }
        return applied;
      },
    }),
    [updateDraft],
  );

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();

    const cancelIdle = scheduleAgentPass(() => {
      void runAgentPass({
        data: dataRef.current,
        actions,
        enabled: autonomy === "ambient",
        signal: controller.signal,
      }).then(() => {
        if (!controller.signal.aborted) setModelSignals(allSignals());
      });
    });

    return () => {
      controller.abort();
      cancelIdle();
    };
    // Re-passes when the ledger finishes loading, autonomy changes, or the
    // draft count moves — the last of which is what makes an import trigger
    // categorisation without anything explicitly asking it to.
  }, [ready, autonomy, actions, data.inbox.drafts.length]);

  const computed = useMemo(
    () => buildComputedSignals({ data, dismissed }),
    [data, dismissed],
  );

  const signals = useMemo(() => {
    const live = modelSignals.filter((signal) => !dismissed.includes(signal.id));
    // Computed wins on id collision: if both layers describe the same fact,
    // the one whose numbers we can prove is the one that renders.
    const seen = new Set(computed.map((signal) => signal.id));
    return rankSignals([...computed, ...live.filter((signal) => !seen.has(signal.id))]);
  }, [computed, modelSignals, dismissed]);

  const dismiss = useCallback(
    (signal: Signal) => {
      setDismissed(persistDismissal(signal.id));
      forgetSignal(signal.id);
      // An anomaly dismissal is a decision about the ledger, not about this
      // screen — push it through the store so it syncs and sticks.
      if (signal.kind === "anomaly") dismissAlert(signal.id.replace(/^anomaly:/, ""));
    },
    [dismissAlert],
  );

  const value = useMemo<AgentValue>(() => ({ signals, dismiss }), [signals, dismiss]);

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
