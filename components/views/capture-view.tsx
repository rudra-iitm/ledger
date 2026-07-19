"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardPaste, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store/app-store";

export function CaptureView() {
  const params = useSearchParams();
  const router = useRouter();
  const captureText = useAppStore((state) => state.captureText);
  const status = useAppStore((state) => state.status);
  const [value, setValue] = useState("");
  const handledShare = useRef(false);

  const sharedText = [params.get("title"), params.get("text"), params.get("url")]
    .filter(Boolean)
    .join(" ")
    .trim();

  // Arriving via the PWA share sheet: capture immediately and land in the inbox.
  useEffect(() => {
    if (!sharedText || handledShare.current || status !== "ready") return;
    handledShare.current = true;
    const result = captureText(sharedText);
    if (result === "created") toast.success("Added to your Inbox for review");
    else if (result === "duplicate") toast("Already captured — skipping");
    else toast.error("Couldn't find a payment in the shared text");
    router.replace("/inbox");
  }, [sharedText, status, captureText, router]);

  const submit = () => {
    const result = captureText(value);
    if (result === "created") {
      toast.success("Added to your Inbox for review");
      setValue("");
      router.push("/inbox");
    } else if (result === "duplicate") {
      toast("Already captured — that message is in your ledger");
    } else {
      toast.error(
        "Couldn't find an amount in that text. Try pasting the full SMS.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="capture-text">Payment SMS or UPI message</Label>
        <textarea
          id="capture-text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={6}
          placeholder={
            "Paste something like:\nRs.450.00 debited from A/c XX1234 on 19-Jul-26 to VPA swiggy@icici UPI Ref 521345678901"
          }
          className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-[15px] leading-relaxed shadow-soft outline-none transition-[border-color,box-shadow] focus:border-ring/60 focus:ring-4 focus:ring-ring/15"
        />
      </div>
      <Button size="lg" disabled={!value.trim()} onClick={submit}>
        <ClipboardPaste aria-hidden />
        Parse &amp; add to Inbox
      </Button>
      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
        <Inbox aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Captured payments land in your Inbox as drafts — nothing enters the
        ledger until you confirm. On your phone, share any payment SMS or UPI
        screenshot text straight to Ledger from the share sheet.
      </p>
    </div>
  );
}
