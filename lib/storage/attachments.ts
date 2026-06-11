import { del, get, set } from "idb-keyval";

export interface AttachmentBlob {
  mimeType: string;
  data: string;
}

export interface AttachmentStore {
  put(id: string, blob: AttachmentBlob): Promise<void>;
  get(id: string): Promise<AttachmentBlob | null>;
  remove(id: string): Promise<void>;
}

const KEY_PREFIX = "ledger:attachment:";

export class LocalAttachmentStore implements AttachmentStore {
  async put(id: string, blob: AttachmentBlob): Promise<void> {
    await set(KEY_PREFIX + id, blob);
  }

  async get(id: string): Promise<AttachmentBlob | null> {
    return (await get<AttachmentBlob>(KEY_PREFIX + id)) ?? null;
  }

  async remove(id: string): Promise<void> {
    await del(KEY_PREFIX + id);
  }
}

export async function fileToAttachmentBlob(file: File): Promise<AttachmentBlob> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { mimeType: file.type || "application/octet-stream", data: btoa(binary) };
}

export function attachmentToDataUrl(blob: AttachmentBlob): string {
  return `data:${blob.mimeType};base64,${blob.data}`;
}

export function downloadAttachment(name: string, blob: AttachmentBlob): void {
  const link = document.createElement("a");
  link.href = attachmentToDataUrl(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
