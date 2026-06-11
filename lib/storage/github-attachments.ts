import { Octokit } from "octokit";
import type { AttachmentBlob, AttachmentStore } from "./attachments";

const DATA_REPO = "ledger-data";

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status: number }).status;
  }
  return undefined;
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

  private pathFor(id: string): string {
    return `attachments/${id}.json`;
  }

  async put(id: string, blob: AttachmentBlob): Promise<void> {
    const owner = await this.owner;
    const content = btoa(
      String.fromCharCode(
        ...new TextEncoder().encode(JSON.stringify(blob)),
      ),
    );
    await this.octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo: DATA_REPO,
      path: this.pathFor(id),
      message: `Add attachment ${id}`,
      content,
      ...(this.shaCache.has(id) ? { sha: this.shaCache.get(id) } : {}),
    });
  }

  async get(id: string): Promise<AttachmentBlob | null> {
    const owner = await this.owner;
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo: DATA_REPO,
        path: this.pathFor(id),
      });
      if (Array.isArray(data) || data.type !== "file") return null;
      this.shaCache.set(id, data.sha);
      const json = new TextDecoder().decode(
        Uint8Array.from(atob(data.content.replace(/\n/g, "")), (c) =>
          c.charCodeAt(0),
        ),
      );
      return JSON.parse(json) as AttachmentBlob;
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const owner = await this.owner;
    let sha = this.shaCache.get(id);
    if (!sha) {
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner,
          repo: DATA_REPO,
          path: this.pathFor(id),
        });
        if (!Array.isArray(data) && data.type === "file") sha = data.sha;
      } catch (error) {
        if (statusOf(error) === 404) return;
        throw error;
      }
    }
    if (!sha) return;
    await this.octokit.rest.repos.deleteFile({
      owner,
      repo: DATA_REPO,
      path: this.pathFor(id),
      message: `Remove attachment ${id}`,
      sha,
    });
    this.shaCache.delete(id);
  }
}
