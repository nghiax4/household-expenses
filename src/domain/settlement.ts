import type { Expense } from './expense';
import { sum, type Cents, type PersonName } from './money';
import type { PersonCell, ShareStatus } from './personCell';
import { fail, ok, type Result } from './result';

/** One unpaid share: the debtor owes the expense's payer this amount. */
export interface Debt {
  debtor: PersonName;
  creditor: PersonName;
  amount: Cents;
}

/** One payment line of a settlement: `from` pays `to`. */
export interface Transfer {
  from: PersonName;
  to: PersonName;
  amount: Cents;
}

/**
 * Every share still Not paid on live expenses #1 to #coversUpToId. Shares already marked
 * Paid individually are skipped. The payer's own share is never a debt.
 */
export function collectUnpaidDebts(expenses: readonly Expense[], coversUpToId: number): Debt[] {
  return expenses
    .filter((expense) => expense.deletedAt === null && expense.id <= coversUpToId)
    .flatMap((expense) =>
      Object.entries(expense.people).flatMap(([person, cell]): Debt[] =>
        cell.kind === 'share' && cell.status === 'Not paid' && person !== expense.payer
          ? [{ debtor: person, creditor: expense.payer, amount: cell.amount }]
          : [],
      ),
    );
}

/**
 * Each person's net balance, in person-column order: positive means they are owed money,
 * negative means they owe. The balances always add up to $0.00.
 */
export function netBalances(
  people: readonly PersonName[],
  debts: readonly Debt[],
): Map<PersonName, Cents> {
  const balances = new Map(people.map((person) => [person, 0]));
  for (const { debtor, creditor, amount } of debts) {
    balances.set(debtor, (balances.get(debtor) ?? 0) - amount);
    balances.set(creditor, (balances.get(creditor) ?? 0) + amount);
  }
  return balances;
}

/** The fewest transfers that bring every balance to $0.00. */
export function minimizeTransfers(balances: ReadonlyMap<PersonName, Cents>): Transfer[] {
  if (sum(balances.values()) !== 0) {
    throw new Error('Balances must add up to $0.00 before they can be settled.');
  }
  const people = [...balances].filter(([, balance]) => balance !== 0);
  return findZeroSumGroups(people).flatMap(settleGroup);
}

type Balance = [PersonName, Cents];

/**
 * Splits people into as many groups as possible whose balances each add up to zero.
 *
 * Why: a group of k people can always be settled in k − 1 transfers, and a group with no
 * smaller zero-sum group inside it can't do better. So the fewest transfers overall is
 * (number of people) − (number of groups), and we want the most groups.
 *
 * How: a set of people is a bitmask (bit i set means people[i] is in it). For every set,
 * mostGroups[set] is the most zero-sum groups it splits into. Build it by removing one person:
 * take the best result for any set one person smaller, and if this whole set adds up to zero,
 * that removed person closes one more group. With 7 people that's only 128 sets.
 */
function findZeroSumGroups(people: readonly Balance[]): Balance[][] {
  const fullSet = (1 << people.length) - 1;
  const membersOf = (set: number) => people.flatMap((_, i) => (set & (1 << i) ? [i] : []));
  const without = (set: number, i: number) => set & ~(1 << i);
  const addsUpToZero = (set: number) => sum(membersOf(set).map((i) => people[i]![1])) === 0;

  const mostGroups = [0];
  for (let set = 1; set <= fullSet; set++) {
    const bestSmaller = Math.max(...membersOf(set).map((i) => mostGroups[without(set, i)]!));
    mostGroups[set] = bestSmaller + (addsUpToZero(set) ? 1 : 0);
  }

  // Walk back from everyone to no one, removing people in the order that achieved the best
  // count. Each time the people still left add up to zero, the ones removed since the last
  // such point form one group.
  const groups: number[][] = [];
  let currentGroup: number[] = [];
  let set = fullSet;
  while (set !== 0) {
    const target = mostGroups[set]! - (addsUpToZero(set) ? 1 : 0);
    const removed = membersOf(set).find((i) => mostGroups[without(set, i)] === target)!;
    currentGroup.push(removed);
    set = without(set, removed);
    if (addsUpToZero(set)) {
      groups.push(currentGroup);
      currentGroup = [];
    }
  }

  // Keep person-column order within and across groups, so results are predictable.
  return groups
    .map((group) => group.sort((a, b) => a - b))
    .sort((a, b) => a[0]! - b[0]!)
    .map((group) => group.map((i) => people[i]!));
}

/** Settles a zero-sum group in at most k − 1 transfers: each one clears at least one person. */
function settleGroup(group: readonly Balance[]): Transfer[] {
  const debtors = group
    .filter(([, balance]) => balance < 0)
    .map(([name, balance]) => ({ name, owes: -balance }));
  const creditors = group
    .filter(([, balance]) => balance > 0)
    .map(([name, balance]) => ({ name, owed: balance }));

  const transfers: Transfer[] = [];
  let debtor = debtors.shift();
  let creditor = creditors.shift();
  while (debtor && creditor) {
    const amount = Math.min(debtor.owes, creditor.owed);
    transfers.push({ from: debtor.name, to: creditor.name, amount });
    debtor.owes -= amount;
    creditor.owed -= amount;
    if (debtor.owes === 0) {
      debtor = debtors.shift();
    }
    if (creditor.owed === 0) {
      creditor = creditors.shift();
    }
  }
  return transfers;
}

/** What "Get total settlement" would create right now. */
export interface SettlementProposal {
  /** The latest expense ID: the settlement covers (and, while open, locks) expenses #1 to #N. */
  coversUpToId: number;
  /** Every unpaid share it covers. */
  debts: Debt[];
  /** Empty when the unpaid shares cancel out, so nobody needs to send money. */
  transfers: Transfer[];
}

/** The settlement to propose now, or null when every share has been paid back. */
export function proposeSettlement(
  expenses: readonly Expense[],
  people: readonly PersonName[],
): SettlementProposal | null {
  const coversUpToId = Math.max(0, ...expenses.map((expense) => expense.id));
  const debts = collectUnpaidDebts(expenses, coversUpToId);
  if (debts.length === 0) {
    return null;
  }
  return { coversUpToId, debts, transfers: minimizeTransfers(netBalances(people, debts)) };
}

/** True when both lists have the same transfers in the same order. */
export function sameTransfers(a: readonly Transfer[], b: readonly Transfer[]): boolean {
  return (
    a.length === b.length &&
    a.every((t, i) => t.from === b[i]?.from && t.to === b[i]?.to && t.amount === b[i]?.amount)
  );
}

/** One transfer of a saved settlement, ticked off once it has been sent. */
export interface SettlementLine extends Transfer {
  status: ShareStatus;
  /** When it was marked Paid, or null while it's Not paid. */
  paidAt: string | null;
}

/** A saved settlement: rows of the Settlements tab sharing one Settlement ID. */
export interface Settlement {
  /** Sequential and never reused. */
  id: number;
  /** When it was created, e.g. "2026-11-22 14:05". */
  createdAt: string;
  coversUpToId: number;
  /** Never empty: unpaid shares that cancel out are settled without saving a settlement. */
  lines: SettlementLine[];
  /** When it was cancelled, or null. */
  cancelledAt: string | null;
}

/**
 * Pending until every line is Paid, then closed. Derived rather than stored, so it can't
 * disagree with the lines.
 */
export type SettlementState = 'pending' | 'closed' | 'cancelled';

export function settlementState(settlement: Settlement): SettlementState {
  if (settlement.cancelledAt !== null) {
    return 'cancelled';
  }
  return settlement.lines.every((line) => line.status === 'Paid') ? 'closed' : 'pending';
}

/** The settlement still being paid, if any. There's at most one. */
export function pendingSettlement(settlements: readonly Settlement[]): Settlement | null {
  return settlements.find((settlement) => settlementState(settlement) === 'pending') ?? null;
}

/**
 * The pending settlement that covers this expense, if any. While it's pending, the expense
 * can't be edited, deleted or marked: that would change amounts the settlement already used.
 */
export function lockingSettlement(
  settlements: readonly Settlement[],
  expenseId: number,
): Settlement | null {
  const pending = pendingSettlement(settlements);
  return pending && expenseId <= pending.coversUpToId ? pending : null;
}

/** A line's new status, as the app sends it. Lines are known by who pays whom. */
export interface TransferStatus {
  from: PersonName;
  to: PersonName;
  status: ShareStatus;
}

/**
 * The settlement with these lines marked Paid or Not paid at `time`. Only a pending settlement
 * can change: a closed one has already marked its shares Paid.
 */
export function withTransferStatuses(
  settlement: Settlement,
  changes: readonly TransferStatus[],
  time: string,
): Result<Settlement> {
  const state = settlementState(settlement);
  if (state === 'cancelled') {
    return fail(`Settlement #${settlement.id} was cancelled.`);
  }
  if (state === 'closed') {
    return fail(`Settlement #${settlement.id} is already closed: every transfer was paid.`);
  }
  let lines = settlement.lines;
  for (const { from, to, status } of changes) {
    if (!lines.some((line) => line.from === from && line.to === to)) {
      return fail(`Settlement #${settlement.id} has no transfer from ${from} to ${to}.`);
    }
    lines = lines.map((line) => {
      if (line.from !== from || line.to !== to || line.status === status) {
        return line;
      }
      return { ...line, status, paidAt: status === 'Paid' ? time : null };
    });
  }
  return ok({ ...settlement, lines });
}

/**
 * What closing a settlement changes: each live expense up to #N that still has Not paid shares,
 * with those shares now Paid. That's the clean slate after everyone has sent their transfer.
 */
export function paidOffExpenses(expenses: readonly Expense[], coversUpToId: number): Expense[] {
  return expenses.flatMap((expense) => {
    if (expense.deletedAt !== null || expense.id > coversUpToId) {
      return [];
    }
    const isUnpaid = (cell: PersonCell) => cell.kind === 'share' && cell.status === 'Not paid';
    if (!Object.values(expense.people).some(isUnpaid)) {
      return [];
    }
    const people = Object.fromEntries(
      Object.entries(expense.people).map(([person, cell]): [PersonName, PersonCell] => [
        person,
        cell.kind === 'share' ? { ...cell, status: 'Paid' } : cell,
      ]),
    );
    return [{ ...expense, people }];
  });
}
