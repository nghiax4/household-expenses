import { describe, expect, it } from 'vitest';
import type { Expense } from './expense';
import { sum, type Cents, type PersonName } from './money';
import { parsePersonCell, type PersonCell } from './personCell';
import {
  collectUnpaidDebts,
  lockingSettlement,
  minimizeTransfers,
  netBalances,
  paidOffExpenses,
  pendingSettlement,
  proposeSettlement,
  sameTransfers,
  settlementState,
  withTransferStatuses,
  type Settlement,
  type Transfer,
} from './settlement';

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
  it('skips paid shares, the payer, deleted expenses and expenses after #N', () => {
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

describe('proposeSettlement', () => {
  it('covers up to the latest expense ID, including a deleted one', () => {
    const expenses = [
      ...EXAMPLE_EXPENSES,
      expense(6, 'Anh', ['$1.00 · Paid', '$1.00 · Not paid', NI, NI, NI, NI, NI], '2026-11-03'),
    ];
    const proposal = proposeSettlement(expenses, PEOPLE);
    expect(proposal?.coversUpToId).toBe(6);
    // The deleted expense's share isn't a debt.
    expect(proposal?.debts).toEqual(collectUnpaidDebts(EXAMPLE_EXPENSES, 5));
    expect(proposal?.transfers).toHaveLength(4);
  });

  it('is null when every share is paid, or there are no expenses', () => {
    expect(proposeSettlement([], PEOPLE)).toBeNull();
    const paid = expense(1, 'Anh', ['$5.00 · Paid', '$5.00 · Paid', NI, NI, NI, NI, NI]);
    expect(proposeSettlement([paid], PEOPLE)).toBeNull();
  });

  it('has no transfers when the unpaid shares cancel out', () => {
    const expenses = [
      expense(1, 'Anh', ['$5.00 · Paid', '$5.00 · Not paid', NI, NI, NI, NI, NI]),
      expense(2, 'Bảo', ['$5.00 · Not paid', '$5.00 · Paid', NI, NI, NI, NI, NI]),
    ];
    const proposal = proposeSettlement(expenses, PEOPLE);
    expect(proposal?.debts).toHaveLength(2);
    expect(proposal?.transfers).toEqual([]);
  });
});

describe('sameTransfers', () => {
  const a: Transfer = { from: 'Anh', to: 'Bảo', amount: 100 };
  const b: Transfer = { from: 'Chi', to: 'Bảo', amount: 200 };
  it('compares who, whom, how much and the order', () => {
    expect(sameTransfers([a, b], [{ ...a }, { ...b }])).toBe(true);
    expect(sameTransfers([], [])).toBe(true);
    expect(sameTransfers([a, b], [b, a])).toBe(false);
    expect(sameTransfers([a], [{ ...a, amount: 101 }])).toBe(false);
    expect(sameTransfers([a], [a, b])).toBe(false);
  });
});

/** Settlement #id covering expenses up to #5: Chi → Anh $10.00 and Dương → Anh $5.00. */
function settlement(id: number, overrides: Partial<Settlement> = {}): Settlement {
  return {
    id,
    createdAt: '2026-11-20 09:00',
    coversUpToId: 5,
    lines: [
      { from: 'Chi', to: 'Anh', amount: 1000, status: 'Not paid', paidAt: null },
      { from: 'Dương', to: 'Anh', amount: 500, status: 'Not paid', paidAt: null },
    ],
    cancelledAt: null,
    ...overrides,
  };
}

const ALL_PAID = settlement(1).lines.map((line) => ({
  ...line,
  status: 'Paid' as const,
  paidAt: '2026-11-21 10:00',
}));

describe('settlement state and locks', () => {
  it('is pending until every line is paid, then closed; cancelled wins', () => {
    expect(settlementState(settlement(1))).toBe('pending');
    expect(settlementState(settlement(1, { lines: ALL_PAID }))).toBe('closed');
    expect(settlementState(settlement(1, { cancelledAt: '2026-11-20 10:00' }))).toBe('cancelled');
  });

  it('locks expenses up to #N only while the settlement is pending', () => {
    const closed = settlement(1, { lines: ALL_PAID });
    const cancelled = settlement(2, { cancelledAt: '2026-11-21 10:00' });
    const pending = settlement(3, { coversUpToId: 8 });
    expect(pendingSettlement([closed, cancelled])).toBeNull();
    expect(lockingSettlement([closed, cancelled], 1)).toBeNull();
    expect(lockingSettlement([closed, cancelled, pending], 8)?.id).toBe(3);
    expect(lockingSettlement([closed, cancelled, pending], 9)).toBeNull();
  });
});

describe('withTransferStatuses', () => {
  const chiPaid = { from: 'Chi', to: 'Anh', status: 'Paid' } as const;

  it('marks lines paid with the time, and back to not paid', () => {
    const marked = withTransferStatuses(settlement(1), [chiPaid], '2026-11-21 10:00');
    expect(marked.ok && marked.value.lines).toEqual([
      { from: 'Chi', to: 'Anh', amount: 1000, status: 'Paid', paidAt: '2026-11-21 10:00' },
      { from: 'Dương', to: 'Anh', amount: 500, status: 'Not paid', paidAt: null },
    ]);
    const unmarked =
      marked.ok && withTransferStatuses(marked.value, [{ ...chiPaid, status: 'Not paid' }], 'x');
    expect(unmarked && unmarked.ok && unmarked.value).toEqual(settlement(1));
  });

  it('keeps the first paid time when a line is marked paid again', () => {
    const once = withTransferStatuses(settlement(1), [chiPaid], '2026-11-21 10:00');
    const twice = once.ok && withTransferStatuses(once.value, [chiPaid], 'later');
    expect(twice && twice.ok && twice.value.lines[0]?.paidAt).toBe('2026-11-21 10:00');
  });

  it('refuses an unknown line, a closed settlement and a cancelled one', () => {
    expect(
      withTransferStatuses(settlement(1), [{ from: 'Anh', to: 'Chi', status: 'Paid' }], 't'),
    ).toEqual({ ok: false, error: 'Settlement #1 has no transfer from Anh to Chi.' });
    expect(
      withTransferStatuses(
        settlement(2, { lines: ALL_PAID }),
        [{ ...chiPaid, status: 'Not paid' }],
        't',
      ),
    ).toEqual({ ok: false, error: 'Settlement #2 is already closed: every transfer was paid.' });
    expect(withTransferStatuses(settlement(3, { cancelledAt: 't' }), [], 't')).toEqual({
      ok: false,
      error: 'Settlement #3 was cancelled.',
    });
  });
});

describe('paidOffExpenses', () => {
  it('marks every unpaid share Paid on live expenses up to #N, and leaves the rest out', () => {
    const expenses = [
      expense(1, 'Anh', ['$5.00 · Paid', '$5.00 · Not paid', '$5.00 · Paid', NI, NI, NI, NI]),
      expense(2, 'Anh', ['$5.00 · Paid', '$5.00 · Paid', NI, NI, NI, NI, NI]),
      expense(3, 'Anh', ['$5.00 · Paid', '$5.00 · Not paid', NI, NI, NI, NI, NI], '2026-11-02'),
      expense(4, 'Anh', ['$5.00 · Paid', '$5.00 · Not paid', NI, NI, NI, NI, NI]),
    ];
    const changed = paidOffExpenses(expenses, 3);
    expect(changed.map((e) => e.id)).toEqual([1]);
    expect(changed[0]?.people).toEqual({
      ...expenses[0]!.people,
      Bảo: { kind: 'share', amount: 500, status: 'Paid' },
    });
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
