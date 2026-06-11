import type { Group, Settlement } from "./types";
import { fromMinorUnits, splitEqually, toMinorUnits } from "./money";

export function computeBalances(group: Group): Map<string, number> {
  const balances = new Map<string, number>(
    group.members.map((member) => [member.id, 0]),
  );

  for (const expense of group.expenses) {
    const participants = expense.splitAmong.filter((id) => balances.has(id));
    if (participants.length === 0) continue;

    const shares = splitEqually(expense.amount, participants.length);
    participants.forEach((memberId, index) => {
      balances.set(
        memberId,
        (balances.get(memberId) ?? 0) - toMinorUnits(shares[index]),
      );
    });

    if (balances.has(expense.paidBy)) {
      balances.set(
        expense.paidBy,
        (balances.get(expense.paidBy) ?? 0) + toMinorUnits(expense.amount),
      );
    }
  }

  return new Map(
    Array.from(balances, ([id, minor]) => [id, fromMinorUnits(minor)]),
  );
}

export function optimizeSettlements(balances: Map<string, number>): Settlement[] {
  const creditors: Array<{ id: string; minor: number }> = [];
  const debtors: Array<{ id: string; minor: number }> = [];

  for (const [id, balance] of balances) {
    const minor = toMinorUnits(balance);
    if (minor > 0) creditors.push({ id, minor });
    else if (minor < 0) debtors.push({ id, minor: -minor });
  }

  const settlements: Settlement[] = [];

  for (const debtor of debtors) {
    const exactIndex = creditors.findIndex(
      (creditor) => creditor.minor === debtor.minor,
    );
    if (exactIndex !== -1) {
      const creditor = creditors[exactIndex];
      settlements.push({
        from: debtor.id,
        to: creditor.id,
        amount: fromMinorUnits(debtor.minor),
      });
      debtor.minor = 0;
      creditors.splice(exactIndex, 1);
    }
  }

  const remainingDebtors = debtors.filter((debtor) => debtor.minor > 0);
  remainingDebtors.sort((a, b) => b.minor - a.minor);
  creditors.sort((a, b) => b.minor - a.minor);

  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < remainingDebtors.length && creditorIndex < creditors.length) {
    const debtor = remainingDebtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const transfer = Math.min(debtor.minor, creditor.minor);

    if (transfer > 0) {
      settlements.push({
        from: debtor.id,
        to: creditor.id,
        amount: fromMinorUnits(transfer),
      });
    }

    debtor.minor -= transfer;
    creditor.minor -= transfer;
    if (debtor.minor === 0) debtorIndex += 1;
    if (creditor.minor === 0) creditorIndex += 1;
  }

  return settlements;
}

export function settleGroup(group: Group): Settlement[] {
  return optimizeSettlements(computeBalances(group));
}
