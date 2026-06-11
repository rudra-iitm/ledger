"use client";

import { useState } from "react";
import { Download, FileText, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Attachment } from "@/lib/domain/types";
import {
  attachmentToDataUrl,
  downloadAttachment,
  previewPdfNative,
  type AttachmentBlob,
} from "@/lib/storage/attachments";
import { useAppStore } from "@/lib/store/app-store";

export function AttachmentGallery({ attachments }: { attachments: Attachment[] }) {
  const getAttachment = useAppStore((state) => state.getAttachment);
  const [preview, setPreview] = useState<{
    attachment: Attachment;
    blob: AttachmentBlob;
  } | null>(null);

  const open = async (attachment: Attachment) => {
    const blob = await getAttachment(attachment.id);
    if (!blob) {
      toast.error("Attachment unavailable");
      return;
    }
    if (blob.mimeType === "application/pdf") {
      previewPdfNative(blob);
      return;
    }
    setPreview({ attachment, blob });
  };

  if (attachments.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-2">
        {attachments.map((attachment) => {
          const isImage = attachment.mimeType.startsWith("image/");
          return (
            <li key={attachment.id}>
              <button
                type="button"
                onClick={() => open(attachment)}
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isImage ? (
                  <ImageIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {attachment.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">
              {preview?.attachment.name}
            </DialogTitle>
          </DialogHeader>
          {preview &&
            (preview.blob.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachmentToDataUrl(preview.blob)}
                alt={preview.attachment.name}
                className="max-h-[60vh] w-full rounded-xl object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <FileText aria-hidden className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Preview not available for this file type.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    preview &&
                    downloadAttachment(preview.attachment.name, preview.blob)
                  }
                >
                  <Download aria-hidden />
                  Download
                </Button>
              </div>
            ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
