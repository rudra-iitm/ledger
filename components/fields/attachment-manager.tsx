"use client";

import { useRef, useState } from "react";
import { Download, FileText, ImageIcon, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Attachment } from "@/lib/domain/types";
import {
  attachmentToDataUrl,
  downloadAttachment,
  type AttachmentBlob,
} from "@/lib/storage/attachments";
import { useAppStore } from "@/lib/store/app-store";

const ACCEPT = "image/*,application/pdf";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentManager({
  expenseId,
  attachments,
}: {
  expenseId: string;
  attachments: Attachment[];
}) {
  const addAttachment = useAppStore((state) => state.addAttachment);
  const removeAttachment = useAppStore((state) => state.removeAttachment);
  const getAttachment = useAppStore((state) => state.getAttachment);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{
    attachment: Attachment;
    blob: AttachmentBlob;
  } | null>(null);

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 5 MB`);
          continue;
        }
        await addAttachment(expenseId, file);
      }
      toast.success("Attachment added");
    } catch {
      toast.error("Could not add attachment");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openPreview = async (attachment: Attachment) => {
    const blob = await getAttachment(attachment.id);
    if (!blob) {
      toast.error("Attachment unavailable");
      return;
    }
    setPreview({ attachment, blob });
  };

  return (
    <div className="flex flex-col gap-2">
      {attachments.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((attachment) => {
            const isImage = attachment.mimeType.startsWith("image/");
            return (
              <li
                key={attachment.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => openPreview(attachment)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {isImage ? (
                    <ImageIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[14px] font-medium">
                      {attachment.name}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      {formatSize(attachment.size)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Download ${attachment.name}`}
                  onClick={async () => {
                    const blob = await getAttachment(attachment.id);
                    if (blob) downloadAttachment(attachment.name, blob);
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Download aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${attachment.name}`}
                  onClick={() => {
                    void removeAttachment(expenseId, attachment.id);
                    toast.success("Attachment removed");
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground outline-none transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => void onPick(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 aria-hidden className="animate-spin" />
        ) : (
          <Paperclip aria-hidden />
        )}
        Add attachment
      </Button>

      <Dialog
        open={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
      >
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
    </div>
  );
}
