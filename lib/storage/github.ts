import { Octokit } from "octokit";
import type { DataFile, StorageAdapter } from "./adapter";

const DATA_REPO = "ledger-data";

function encodeBase64(content: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(content)));
}

function decodeBase64(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class GitHubStorageAdapter implements StorageAdapter {
  private octokit: Octokit;
  private owner = "";
  private shaCache = new Map<DataFile, string>();
  private ready: Promise<void> | null = null;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  private ensureRepo(): Promise<void> {
    this.ready ??= (async () => {
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      this.owner = user.login;
      try {
        await this.octokit.rest.repos.get({
          owner: this.owner,
          repo: DATA_REPO,
        });
      } catch (error) {
        if (isNotFound(error)) {
          await this.octokit.rest.repos.createForAuthenticatedUser({
            name: DATA_REPO,
            private: true,
            description: "Ledger app data — managed automatically",
            auto_init: true,
          });
        } else {
          throw error;
        }
      }
    })();
    return this.ready;
  }

  private pathFor(file: DataFile): string {
    return `data/${file}.json`;
  }

  async readFile(file: DataFile): Promise<string | null> {
    await this.ensureRepo();
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: DATA_REPO,
        path: this.pathFor(file),
      });
      if (Array.isArray(data) || data.type !== "file") return null;
      this.shaCache.set(file, data.sha);
      return decodeBase64(data.content);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async writeFile(file: DataFile, content: string): Promise<void> {
    await this.ensureRepo();
    try {
      await this.put(file, content, this.shaCache.get(file));
    } catch (error) {
      if (isConflict(error) || isNotFound(error)) {
        await this.refreshSha(file);
        await this.put(file, content, this.shaCache.get(file));
      } else {
        throw error;
      }
    }
  }

  private async put(
    file: DataFile,
    content: string,
    sha: string | undefined,
  ): Promise<void> {
    const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: DATA_REPO,
      path: this.pathFor(file),
      message: `Update ${file}`,
      content: encodeBase64(content),
      ...(sha ? { sha } : {}),
    });
    if (data.content?.sha) this.shaCache.set(file, data.content.sha);
  }

  private async refreshSha(file: DataFile): Promise<void> {
    this.shaCache.delete(file);
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: DATA_REPO,
        path: this.pathFor(file),
      });
      if (!Array.isArray(data) && data.type === "file") {
        this.shaCache.set(file, data.sha);
      }
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
}

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status: number }).status;
  }
  return undefined;
}

function isNotFound(error: unknown): boolean {
  return statusOf(error) === 404;
}

function isConflict(error: unknown): boolean {
  const status = statusOf(error);
  return status === 409 || status === 422;
}
