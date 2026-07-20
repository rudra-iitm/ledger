"use client";

/**
 * The off switch.
 *
 * A background process that spends someone's API quota needs three things to
 * be legitimate, and this component is where all three live: the user can see
 * exactly what it is allowed to do, see what it has spent today, and stop it
 * in one tap. Without this the agent is spyware with good intentions.
 *
 * The list of jobs is generated from `AGENT_JOBS` rather than written out, so
 * a job added to the runtime cannot quietly avoid appearing here.
 */

import { useEffect, useState } from "react";
import { AGENT_JOBS } from "@/lib/ai/agent/jobs";
import { DAILY_AGENT_BUDGET } from "@/lib/ai/agent/runtime";
import { spentToday } from "@/lib/ai/agent/run-ledger";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function AutonomyCard() {
  const autonomy = useAppStore((state) => state.data.settings.autonomy);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [spent, setSpent] = useState<number | null>(null);

  // localStorage isn't available during the static export; read after mount.
  useEffect(() => setSpent(spentToday()), [autonomy]);

  const on = autonomy === "ambient";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-[14px] font-medium">Work in the background</h3>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Ledger sorts imports, writes rules it has learned, and refreshes
            your brief on its own — capped at {DAILY_AGENT_BUDGET} calls a day.
            Turn this off and everything still works; you just do the sorting.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Work in the background"
          onClick={() => updateSettings({ autonomy: on ? "off" : "ambient" })}
          className={cn(
            "relative mt-0.5 h-6 w-11 shrink-0 rounded-full outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            on ? "bg-primary" : "bg-input",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-background transition-transform duration-200 ease-spring",
              on ? "translate-x-5.5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>

      {on && (
        <>
          <ul className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
            {AGENT_JOBS.map((job) => (
              <li key={job.id} className="flex flex-col">
                <span className="text-[13px]">{job.label}</span>
                <span className="text-[12px] text-muted-foreground">
                  {job.description}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[12px] tabular-nums text-muted-foreground">
            {spent === null
              ? " "
              : `${spent} of ${DAILY_AGENT_BUDGET} background calls used today.`}
          </p>
        </>
      )}
    </div>
  );
}
