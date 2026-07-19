import { describe, expect, it } from "vitest";
import type { DataFile, StorageAdapter } from "@/lib/storage/adapter";
import { EMPTY_DATA, LedgerRepository } from "@/lib/storage/repository";

function adapterWith(files: Partial<Record<DataFile, string>>): StorageAdapter {
  return {
    readFile: async (file) => files[file] ?? null,
    writeFile: async () => {},
  };
}

describe("LedgerRepository.loadAll", () => {
  it("returns defaults with no invalid files for an empty store", async () => {
    const repo = new LedgerRepository(adapterWith({}));
    const { data, invalidFiles } = await repo.loadAll();
    expect(invalidFiles).toEqual([]);
    expect(data.expenses).toEqual([]);
    expect(data.accounts).toEqual(EMPTY_DATA.accounts);
  });

  it("loads and migrates valid content", async () => {
    const repo = new LedgerRepository(
      adapterWith({
        expenses: JSON.stringify([
          {
            id: "e1",
            description: "Chai",
            amount: 20,
            category: "Food",
            date: "2026-07-01",
            createdAt: "2026-07-01T00:00:00.000Z",
          },
        ]),
      }),
    );
    const { data, invalidFiles } = await repo.loadAll();
    expect(invalidFiles).toEqual([]);
    expect(data.expenses[0]).toMatchObject({
      id: "e1",
      tags: [],
      affectsBalance: true,
    });
  });

  it("flags corrupt JSON as invalid instead of throwing", async () => {
    const repo = new LedgerRepository(adapterWith({ expenses: "{not json" }));
    const { data, invalidFiles } = await repo.loadAll();
    expect(invalidFiles).toEqual(["expenses"]);
    expect(data.expenses).toEqual([]);
  });

  it("flags schema-invalid content as invalid instead of silently defaulting", async () => {
    const repo = new LedgerRepository(
      adapterWith({
        expenses: JSON.stringify([{ id: "e1", amount: "not-a-number" }]),
        goals: JSON.stringify([{ bogus: true }]),
      }),
    );
    const { data, invalidFiles } = await repo.loadAll();
    expect(invalidFiles.sort()).toEqual(["expenses", "goals"]);
    expect(data.expenses).toEqual([]);
    expect(data.goals).toEqual([]);
  });
});
