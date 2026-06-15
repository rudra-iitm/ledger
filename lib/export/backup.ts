import { DATA_FILES, type DataFile } from "@/lib/storage/adapter";
import { migrate } from "@/lib/storage/migrations";
import {
  EMPTY_DATA,
  FILE_SCHEMAS,
  type LedgerData,
} from "@/lib/storage/repository";

const BACKUP_VERSION = 1;

interface Backup {
  app: "ledger";
  version: number;
  exportedAt: string;
  data: LedgerData;
}

export function buildBackup(data: LedgerData): string {
  const backup: Backup = {
    app: "ledger",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  return JSON.stringify(backup, null, 2);
}

export function backupFilename(now: Date = new Date()): string {
  return `ledger-backup-${now.toISOString().slice(0, 10)}.json`;
}

export class BackupParseError extends Error {}

export function parseBackup(json: string): LedgerData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new BackupParseError("That file isn't valid JSON.");
  }
  if (
    typeof raw !== "object" ||
    raw === null ||
    (raw as { app?: unknown }).app !== "ledger" ||
    typeof (raw as { data?: unknown }).data !== "object"
  ) {
    throw new BackupParseError("This doesn't look like a Ledger backup.");
  }

  const source = (raw as { data: Record<string, unknown> }).data;
  const result = { ...EMPTY_DATA };
  for (const file of DATA_FILES) {
    if (!(file in source)) continue;
    const migrated = migrate(file, source[file]);
    const parsed = FILE_SCHEMAS[file].safeParse(migrated);
    if (!parsed.success) {
      throw new BackupParseError(`The "${file}" section is corrupted.`);
    }
    assignFile(result, file, parsed.data);
  }
  return result;
}

function assignFile(
  target: LedgerData,
  file: DataFile,
  value: unknown,
): void {
  (target as Record<DataFile, unknown>)[file] = value;
}
