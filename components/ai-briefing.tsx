"use client";

import { useEffect, useState } from "react";
import { Bot, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { aiAvailable } from "@/lib/ai/gemini";
import { AiError } from "@/lib/ai/provider";
import { buildBriefing } from "@/lib/ai/features/advisor";
import { useAppStore } from "@/lib/store/app-store";

/**
 * The daily brief.
 *
 * Deliberately **not** generated on load. Auto-running would spend the user's
 * own Gemini quota every time they open the app, which is not a decision the
 * app gets to make for them. One tap, then cached for the rest of the day —
 * the date is in the prompt, so the cache key rolls over at midnight on its
 * own.
 */
export function AiBriefing() {
  const data = useAppStore((state) => state.data);
  const [aiOn, setAiOn] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAiOn(aiAvailable());
  }, []);

  const load = async (noCache = false) => {
    setBusy(true);
    try {
      setText(await buildBriefing({ data, now: new Date(), noCache }));
    } catch (error) {
      toast.error(
        error instanceof AiError ? error.message : "Couldn't build your brief.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!aiOn) return null;

  return (
    <section aria-label="Daily brief" className="flex flex-col gap-2">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-soft">
        {text ? (
          <>
            <div className="flex items-start gap-3">
              <Bot aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-[14px] leading-relaxed">{text}</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void load(true)}
              className="self-start text-[12px] text-muted-foreground underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {busy ? "Rewriting…" : "Refresh"}
            </button>
          </>
        ) : (
          <Button
            variant="ghost"
            className="justify-start px-0 text-muted-foreground"
            disabled={busy}
            onClick={() => void load()}
          >
            {busy ? <RefreshCw aria-hidden className="animate-spin" /> : <Bot aria-hidden />}
            {busy ? "Reading your finances…" : "Brief me on today"}
          </Button>
        )}
      </div>
    </section>
  );
}
