import { describe, expect, it } from 'vitest';
import type { Expense } from './expense';
import { sum, type Cents, type PersonName } from './money';
import { parsePersonCell, type PersonCell } from './personCell';
import { collectUnpaidDebts, minimizeTransfers, netBalances, type Transfer } from './settlement';

// Made-up people and amounts (the repo is public), in person-column order.
const PEOPLE = ['Anh', 'Bảo', 'Chi', 'Dương', 'Em', 'Giang', 'Hà'];

/** Builds an expense from person cells written exactly as they appear in the sheet. */
function expense(id: number, payer: PersonName, cells: string[], deletedAt?: string): Expense {
  const people: Record<PersonName, PersonCell> = {};
  cells.forEach((text, i) => {
    const parsed = parsePersonCell(text);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    people[PEOPLE[i]!] = parsed.value;
  });
  return {
    id,
    date: '2026-11-01',
    description: `Expense #${id}`,
    total: 0, // Not used by settlements.
    payer,
    note: '',
    deletedAt: deletedAt ?? null,
    people,
  };
}

const NI = 'Not involved';

// A typical month: two small bills paid by Anh, three household bills paid by Bảo.
const EXAMPLE_EXPENSES: Expense[] = [
  expense(1, 'Anh', ['$10.00 · Paid', NI, NI, NI, '$10.00 · Not paid', NI, NI]),
  expense(2, 'Anh', [
    '$4.03 · Paid',
    '$4.00 · Not paid',
    '$4.00 · Not paid',
    '$4.00 · Not paid',
    '$4.00 · Not paid',
    NI,
    NI,
  ]),
  expense(3, 'Bảo', [
    '$30.00 · Paid',
    '$30.01 · Paid',
    '$30.00 · Not paid',
    '$30.00 · Not paid',
    NI,
    NI,
    NI,
  ]),
  expense(4, 'Bảo', [
    '$600.00 · Not paid',
    '$600.00 · Paid',
    '$600.00 · Not paid',
    '$600.00 · Not paid',
    NI,
    NI,
    NI,
  ]),
  expense(5, 'Bảo', [
    '$25.00 · Not paid',
    '$25.02 · Paid',
    '$25.00 · Not paid',
    '$25.00 · Not paid',
    NI,
    NI,
    NI,
  ]),
];

function balancesAfter(
  balances: ReadonlyMap<PersonName, Cents>,
  transfers: Transfer[],
): Map<PersonName, Cents> {
  const result = new Map(balances);
  for (const { from, to, amount } of transfers) {
    result.set(from, (result.get(from) ?? 0) + amount);
    result.set(to, (result.get(to) ?? 0) - amount);
  }
  return result;
}

describe('settling a month of expenses', () => {
  it('nets everyone out and pays Bảo back in 4 transfers', () => {
    // Worked out by hand: Anh is owed $26.00 but owes Bảo $625.00 (net −$599.00); Bảo is owed
    // $655.00 each by Chi and Dương and $625.00 by Anh, and owes Anh $4.00 (net +$1,931.00).
    const balances = netBalances(PEOPLE, collectUnpaidDebts(EXAMPLE_EXPENSES, 5));
    expect([...balances]).toEqual([
      ['Anh', -59900],
      ['Bảo', 193100],
      ['Chi', -65900],
      ['Dương', -65900],
      ['Em', -1400],
      ['Giang', 0],
      ['Hà', 0],
    ]);
    expect(minimizeTransfers(balances)).toEqual([
      { from: 'Anh', to: 'Bảo', amount: 59900 },
      { from: 'Chi', to: 'Bảo', amount: 65900 },
      { from: 'Dương', to: 'Bảo', amount: 65900 },
      { from: 'Em', to: 'Bảo', amount: 1400 },
    ]);
  });
});

describe('collectUnpaidDebts', () => {
  it('skips paid shares, the payer, trashed expenses and expenses after #N', () => {
    const expenses = [
      expense(1, 'Bảo', ['$5.00 · Paid', '$5.00 · Paid', '$5.00 · Not paid', NI, NI, NI, NI]),
      expense(2, 'Bảo', ['$9.00 · Not paid', '$9.00 · Paid', NI, NI, NI, NI, NI], '2026-11-02'),
      expense(3, 'Chi', [NI, NI, '$7.00 · Paid', '$7.00 · Not paid', NI, NI, NI]),
      expense(4, 'Chi', ['$1.00 · Not paid', NI, '$1.00 · Paid', NI, NI, NI, NI]),
    ];
    expect(collectUnpaidDebts(expenses, 3)).toEqual([
      { debtor: 'Chi', creditor: 'Bảo', amount: 500 },
      { debtor: 'Dương', creditor: 'Chi', amount: 700 },
    ]);
  });
});

describe('minimizeTransfers', () => {
  it('returns no transfers when everyone is even', () => {
    expect(minimizeTransfers(new Map())).toEqual([]);
    expect(
      minimizeTransfers(
        new Map([
          ['Anh', 0],
          ['Bảo', 0],
        ]),
      ),
    ).toEqual([]);
  });

  it('finds pairs that cancel out, where a simple greedy would need an extra transfer', () => {
    // Paying in column order would take 3 transfers (A→C 4, A→D 2, B→D 4). Pairing
    // A with D and B with C takes 2.
    const balances = new Map([
      ['A', -600],
      ['B', -400],
      ['C', 400],
      ['D', 600],
    ]);
    expect(minimizeTransfers(balances)).toEqual([
      { from: 'A', to: 'D', amount: 600 },
      { from: 'B', to: 'C', amount: 400 },
    ]);
  });

  it('refuses balances that do not add up to zero', () => {
    expect(() =>
      minimizeTransfers(
        new Map([
          ['Anh', 100],
          ['Bảo', -99],
        ]),
      ),
    ).toThrow();
  });

  it('settles everyone with the true minimum number of transfers (random cases)', () => {
    const random = seededRandom(20261119);
    for (let round = 0; round < 500; round++) {
      const size = 2 + Math.floor(random() * 6);
      const amounts = Array.from({ length: size - 1 }, () => Math.floor(random() * 21) - 10);
      amounts.push(-sum(amounts));
      const balances = new Map(amounts.map((amount, i) => [`P${i}`, amount]));

      const transfers = minimizeTransfers(balances);

      expect(transfers.length).toBe(bruteForceMinTransfers(amounts));
      expect(transfers.every((transfer) => transfer.amount > 0)).toBe(true);
      expect([...balancesAfter(balances, transfers).values()].every((b) => b === 0)).toBe(true);
    }
  });
});

/**
 * Independent check for the tests: tries every way of settling the first person with someone
 * of the opposite sign. Exponential, but fine for 7 people.
 */
function bruteForceMinTransfers(balances: number[]): number {
  const remaining = balances.filter((balance) => balance !== 0);
  const search = (start: number): number => {
    while (start < remaining.length && remaining[start] === 0) {
      start++;
    }
    if (start === remaining.length) {
      return 0;
    }
    const current = remaining[start]!;
    let best = Infinity;
    for (let i = start + 1; i < remaining.length; i++) {
      if (remaining[i]! * current < 0) {
        remaining[i]! += current;
        best = Math.min(best, 1 + search(start + 1));
        remaining[i]! -= current;
      }
    }
    return best;
  };
  return search(0);
}

/** Park–Miller generator: the random cases are the same on every run. */
function seededRandom(seed: number): () => number {
  const MODULUS = 2147483647;
  let state = seed % MODULUS;
  return () => {
    state = (state * 48271) % MODULUS;
    return state / MODULUS;
  };
}
