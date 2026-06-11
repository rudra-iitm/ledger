import { describe, expect, it } from "vitest";
import type { DataFile, StorageAdapter } from "@/lib/storage/adapter";
import { EMPTY_DATA, LedgerRepository } from "@/lib/storage/repository";

class MemoryAdapter implements StorageAdapter {
  files = new Map<DataFile, string>();

  async readFile(file: DataFile): Promise<string | null> {
    return this.files.get(file) ?? null;
  }

  async writeFile(file: DataFile, content: string): Promise<void> {
    this.files.set(file, content);
  }
}

describe("LedgerRepository", () => {
  it("returns defaults when files are missing", async () => {
    const repo = new LedgerRepository(new MemoryAdapter());
    const data = await repo.loadAll();
    expect(data).toEqual(EMPTY_DATA);
  });

  it("round-trips saved collections", async () => {
    const adapter = new MemoryAdapter();
    const repo = new LedgerRepository(adapter);
    const expense = {
      id: "e1",
      description: "lunch",
      amount: 450,
      category: "Food" as const,
      date: "2026-06-10",
      createdAt: "2026-06-10T10:00:00.000Z",
    };

    await repo.save("expenses", [expense]);
    await repo.save("budgets", { monthlyBudget: 30000 });

    const data = await repo.loadAll();
    expect(data.expenses).toEqual([expense]);
    expect(data.budgets.monthlyBudget).toBe(30000);
  });

  it("falls back to defaults on corrupt data", async () => {
    const adapter = new MemoryAdapter();
    adapter.files.set("expenses", JSON.stringify([{ bad: true }]));
    const repo = new LedgerRepository(adapter);
    const data = await repo.loadAll();
    expect(data.expenses).toEqual([]);
  });
});
