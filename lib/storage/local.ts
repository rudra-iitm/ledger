import type { DataFile, StorageAdapter } from "./adapter";

const KEY_PREFIX = "ledger:data:";

export class LocalStorageAdapter implements StorageAdapter {
  async readFile(file: DataFile): Promise<string | null> {
    return window.localStorage.getItem(KEY_PREFIX + file);
  }

  async writeFile(file: DataFile, content: string): Promise<void> {
    window.localStorage.setItem(KEY_PREFIX + file, content);
  }
}
