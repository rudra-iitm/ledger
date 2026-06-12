export const DATA_FILES = [
  "expenses",
  "recurring",
  "groups",
  "budgets",
  "settings",
  "accounts",
  "spaces",
  "subscriptions",
  "lendBorrows",
] as const;

export type DataFile = (typeof DATA_FILES)[number];

export interface StorageAdapter {
  readFile(file: DataFile): Promise<string | null>;
  writeFile(file: DataFile, content: string): Promise<void>;
}
