"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot, Camera, FileUp, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AccountSelect } from "@/components/fields/account-select";
import { DateField } from "@/components/fields/date-field";
import { aiAvailable } from "@/lib/ai/gemini";
import { AiError } from "@/lib/ai/provider";
import {
  extractDocument,
  isUsable,
  MAX_FILE_BYTES,
  SUPPORTED_TYPES,
  toCapture,
} from "@/lib/ai/features/documents";
import type { DocumentExtraction } from "@/lib/ai/schemas";
import { CATEGORIES, type Category } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";

const CONFIDENCE_COPY = {
  high: "Read cleanly",
  medium: "Mostly clear — check the figures",
  low: "Hard to read — check every field",
} as const;

export function ScanView() {
  const router = useRouter();
  const captureDocument = useAppStore((state) => state.captureDocument);
  const [aiOn, setAiOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<DocumentExtraction | null>(null);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAiOn(aiAvailable());
  }, []);

  // Object URLs are a leak if the component unmounts mid-preview.
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setExtraction(null);
    setFileName("");
    setAccountId(undefined);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    }
    setBusy(true);
    try {
      const result = await extractDocument({ file });
      setExtraction(result);
      if (!isUsable(result)) {
        toast.error("Couldn't find a total on that document — enter it by hand.");
      }
    } catch (error) {
      toast.error(
        error instanceof AiError ? error.message : "Couldn't read that document.",
      );
      reset();
    } finally {
      setBusy(false);
    }
  };

  const patch = (changes: Partial<DocumentExtraction>) =>
    setExtraction((current) => (current ? { ...current, ...changes } : current));

  const save = () => {
    if (!extraction) return;
    try {
      const outcome = captureDocument(
        toCapture(extraction, fileName),
        accountId,
      );
      if (outcome === "duplicate") {
        toast("Already captured — this document is in your ledger");
        return;
      }
      toast.success("Added to Inbox — confirm it there");
      reset();
      router.push("/inbox");
    } catch (error) {
      toast.error(
        error instanceof AiError ? error.message : "Couldn't save that.",
      );
    }
  };

  if (!aiOn) {
    return (
      <EmptyState
        icon={Bot}
        title="Scanning needs a Gemini key"
        description="Add your own Gemini API key in Settings. Documents are sent to Gemini only when you pick one, and the key never leaves this browser."
        action={
          <Button variant="secondary" asChild>
            <Link href="/settings">Open Settings</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <input
        ref={fileInput}
        type="file"
        accept={SUPPORTED_TYPES.join(",")}
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {!extraction ? (
        <section aria-label="Pick a document" className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-soft">
            <div className="flex items-start gap-3">
              <Bot aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Photograph a receipt or pick a PDF invoice, payslip or statement.
                Ledger extracts the merchant, date, total and line items, shows
                you everything it read, and adds it to your Inbox as a draft —
                nothing reaches your ledger until you confirm it.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => cameraInput.current?.click()}
              >
                <Camera aria-hidden />
                {busy ? "Reading…" : "Take a photo"}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                <FileUp aria-hidden />
                Pick a file
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              JPEG, PNG, WebP or PDF · up to {Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB
            </p>
          </div>
        </section>
      ) : null}

      {extraction ? (
        <section aria-label="Check what was read" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="text-sm font-medium text-muted-foreground">
              Check what was read
            </h2>
            <Badge variant={extraction.confidence === "low" ? "destructive" : "outline"}>
              {CONFIDENCE_COPY[extraction.confidence]}
            </Badge>
          </div>

          {extraction.warnings.length ? (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
              <ul className="flex flex-col gap-0.5">
                {extraction.warnings.map((warning) => (
                  <li key={warning} className="text-[12px] text-muted-foreground">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt="The document you picked"
              className="max-h-64 w-full rounded-2xl border border-border object-contain"
            />
          ) : null}

          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-4 py-4 shadow-soft">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scan-merchant">Merchant</Label>
              <Input
                id="scan-merchant"
                value={extraction.merchant ?? ""}
                placeholder="Who was paid"
                onChange={(event) => patch({ merchant: event.target.value })}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="scan-amount">Total</Label>
                <Input
                  id="scan-amount"
                  inputMode="decimal"
                  value={extraction.totalAmount ?? ""}
                  placeholder="0.00"
                  onChange={(event) =>
                    patch({ totalAmount: Number(event.target.value) || null })
                  }
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="scan-date">Date</Label>
                <DateField
                  id="scan-date"
                  value={extraction.date ?? ""}
                  onChange={(value) => patch({ date: value })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scan-category">Category</Label>
              <Select
                value={extraction.category ?? undefined}
                onValueChange={(value) => patch({ category: value as Category })}
              >
                <SelectTrigger id="scan-category">
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scan-account">Paid from</Label>
              <AccountSelect
                id="scan-account"
                value={accountId}
                onChange={setAccountId}
                allowNone
              />
            </div>
          </div>

          {extraction.lineItems.length ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-soft">
              <h3 className="mb-2 text-[13px] font-medium text-muted-foreground">
                Line items read from the document
              </h3>
              <ul className="flex flex-col gap-1">
                {extraction.lineItems.map((item, index) => (
                  <li
                    key={`${item.description}-${index}`}
                    className="flex justify-between gap-3 text-[13px]"
                  >
                    <span className="text-muted-foreground">{item.description}</span>
                    {item.amount != null ? (
                      <span className="shrink-0 tabular-nums">{item.amount}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button className="flex-1" disabled={!isUsable(extraction)} onClick={save}>
              Add to Inbox
            </Button>
            <Button variant="outline" onClick={reset}>
              <RotateCcw aria-hidden />
              Start over
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
