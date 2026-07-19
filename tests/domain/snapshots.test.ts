import { describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNTS } from "@/lib/domain/types";
import { buildSnapshot, upsertSnapshot } from "@/lib/domain/snapshots";

const NOW = new Date(2026, 6, 19);

describe("snapshots", () => {
  it("captures net worth, assets, and liabilities for the current month", () => {
    const accounts = [
      { ...DEFAULT_ACCOUNTS[0], balance: 2000 },
      { ...DEFAULT_ACCOUNTS[1], balance: 50000 },
      {
        ...DEFAULT_ACCOUNTS[1],
        id: "acc-card",
        type: "credit_card" as const,
        balance: 12000,
      },
    ];
    const snapshot = buildSnapshot(accounts, [], NOW);
    expect(snapshot.month).toBe("2026-07");
    expect(snapshot.assetsTotal).toBe(52000);
    expect(snapshot.liabilitiesTotal).toBe(12000);
    expect(snapshot.netWorth).toBe(40000);
    expect(snapshot.accounts).toHaveLength(3);
  });

  it("upserts the current month in place and reports change", () => {
    const first = buildSnapshot(
      [{ ...DEFAULT_ACCOUNTS[1], balance: 100 }],
      [],
      NOW,
    );
    const initial = upsertSnapshot([], first);
    expect(initial.changed).toBe(true);
    expect(initial.history).toHaveLength(1);

    const unchanged = upsertSnapshot(initial.history, first);
    expect(unchanged.changed).toBe(false);
    expect(unchanged.history).toBe(initial.history);

    const moved = upsertSnapshot(
      initial.history,
      buildSnapshot([{ ...DEFAULT_ACCOUNTS[1], balance: 250 }], [], NOW),
    );
    expect(moved.changed).toBe(true);
    expect(moved.history).toHaveLength(1);
    expect(moved.history[0].netWorth).toBe(250);
  });

  it("keeps history sorted across months", () => {
    const june = {
      ...buildSnapshot([{ ...DEFAULT_ACCOUNTS[1], balance: 10 }], [], NOW),
      month: "2026-06",
    };
    const result = upsertSnapshot(
      [buildSnapshot([{ ...DEFAULT_ACCOUNTS[1], balance: 20 }], [], NOW)],
      june,
    );
    expect(result.history.map((item) => item.month)).toEqual([
      "2026-06",
      "2026-07",
    ]);
  });
});
