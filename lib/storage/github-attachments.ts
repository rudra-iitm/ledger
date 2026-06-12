import { Octokit } from "octokit";
import type { AttachmentBlob, AttachmentStore } from "./attachments";

const DATA_REPO = "ledger-data";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

function extensionFor(mimeType: string): string {
  const known = MIME_EXTENSIONS[mimeType];
  if (known) return known;
  const subtype = (mimeType.split("/")[1] ?? "").replace(/[^a-zA-Z0-9]/g, "");
  return subtype || "bin";
}

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status: number }).status;
  }
  return undefined;
}

interface FileEntry {
  content: string;
  encoding: string;
  sha: string;
}

export class GitHubAttachmentStore implements AttachmentStore {
  private octokit: Octokit;
  private owner: Promise<string>;
  private shaCache = new Map<string, string>();

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
    this.owner = this.octokit.rest.users
      .getAuthenticated()
      .then(({ data }) => data.login);
  }

  private rawPath(id: string, mimeType: string): string {
    return `attachments/${id}.${extensionFor(mimeType)}`;
  }

  private legacyPath(id: string): string {
    return `attachments/${id}.json`;
  }

  private async readFile(path: string): Promise<FileEntry | null> {
    const owner = await this.owner;
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo: DATA_REPO,
        path,
      });
      if (Array.isArray(data) || data.type !== "file") return null;
      this.shaCache.set(path, data.sha);
      if (data.content && data.encoding === "base64") {
        return { content: data.content, encoding: data.encoding, sha: data.sha };
      }
      const { data: blob } = await this.octokit.rest.git.getBlob({
        owner,
        repo: DATA_REPO,
        file_sha: data.sha,
      });
      return { content: blob.content, encoding: blob.encoding, sha: data.sha };
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  }

  async put(id: string, blob: AttachmentBlob): Promise<void> {
    const owner = await this.owner;
    const path = this.rawPath(id, blob.mimeType);
    const sha = this.shaCache.get(path);
    await this.octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo: DATA_REPO,
      path,
      message: `Add attachment ${id}`,
      content: blob.data,
      ...(sha ? { sha } : {}),
    });
  }

  async get(id: string, mimeType?: string): Promise<AttachmentBlob | null> {
    if (mimeType) {
      const raw = await this.readFile(this.rawPath(id, mimeType));
      if (raw) {
        return { mimeType, data: raw.content.replace(/\n/g, "") };
      }
    }
    const legacy = await this.readFile(this.legacyPath(id));
    if (!legacy) return null;
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(legacy.content.replace(/\n/g, "")), (c) =>
        c.charCodeAt(0),
      ),
    );
    return JSON.parse(json) as AttachmentBlob;
  }

  async remove(id: string, mimeType?: string): Promise<void> {
    const owner = await this.owner;
    const paths = [
      ...(mimeType ? [this.rawPath(id, mimeType)] : []),
      this.legacyPath(id),
    ];
    for (const path of paths) {
      let sha = this.shaCache.get(path);
      if (!sha) {
        try {
          const { data } = await this.octokit.rest.repos.getContent({
            owner,
            repo: DATA_REPO,
            path,
          });
          if (!Array.isArray(data) && data.type === "file") sha = data.sha;
        } catch (error) {
          if (statusOf(error) === 404) continue;
          throw error;
        }
      }
      if (!sha) continue;
      await this.octokit.rest.repos.deleteFile({
        owner,
        repo: DATA_REPO,
        path,
        message: `Remove attachment ${id}`,
        sha,
      });
      this.shaCache.delete(path);
      return;
    }
  }
}
