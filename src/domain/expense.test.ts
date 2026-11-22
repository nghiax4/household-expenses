import { describe, expect, it } from 'vitest';
import {
  buildExpense,
  isCalendarDate,
  liveExpensesNewestFirst,
  recentDescriptions,
  type Expense,
  type NewExpense,
} from './expense';

// Made-up people (the repo is public), in person-column order.
const PEOPLE = ['Anh', 'Bảo', 'Chi', 'Dương'];

describe('isCalendarDate', () => {
  it.each(['2026-11-21', '2024-02-29', '2026-01-01'])('accepts %s', (text) => {
    expect(isCalendarDate(text)).toBe(true);
  });

  it.each(['', '2026-11-31', '2025-02-29', '2026-13-01', '2026-1-5', '11/21/2026', '2026-11-21x'])(
    'rejects %j',
    (text) => {
      expect(isCalendarDate(text)).toBe(false);
    },
  );
});

describe('buildExpense', () => {
  const groceries: NewExpense = {
    date: '2026-11-21',
    description: '  Groceries ',
    total: 1000,
    payer: 'Bảo',
    note: ' ',
    shares: { Anh: 333, Bảo: 334, Chi: 333 },
  };

  it('marks the payer Paid, other participants Not paid, and everyone else Not involved', () => {
    expect(buildExpense(groceries, 7, PEOPLE)).toEqual({
      ok: true,
      value: {
        id: 7,
        date: '2026-11-21',
        description: 'Groceries',
        total: 1000,
        payer: 'Bảo',
        note: '',
        deletedAt: null,
        people: {
          Anh: { kind: 'share', amount: 333, status: 'Not paid' },
          Bảo: { kind: 'share', amount: 334, status: 'Paid' },
          Chi: { kind: 'share', amount: 333, status: 'Not paid' },
          Dương: { kind: 'notInvolved' },
        },
      },
    });
  });

  it('allows a payer who is not taking part', () => {
    const result = buildExpense({ ...groceries, payer: 'Dương' }, 1, PEOPLE);
    expect(result.ok && result.value.people).toMatchObject({
      Bảo: { status: 'Not paid' },
      Dương: { kind: 'notInvolved' },
    });
  });

  it.each<[string, Partial<NewExpense>, string]>([
    ['blank description', { description: '  ' }, 'Add a description.'],
    ['zero total', { total: 0, shares: {} }, 'The total must be more than $0.00.'],
    ['fractional cents', { total: 999.5 }, 'The total must be more than $0.00.'],
    ['bad date', { date: '2026-02-30' }, 'Pick a date.'],
    ['unknown payer', { payer: 'Zed' }, 'Pick who paid.'],
    [
      'unknown participant',
      { shares: { Anh: 500, Zed: 500 } },
      '"Zed" isn\'t one of the household\'s people.',
    ],
    [
      'fractional share',
      { shares: { Anh: 499.5, Bảo: 500.5 } },
      'Every share must be a whole number of cents.',
    ],
    ['nobody', { shares: {} }, 'Pick at least one person to split with.'],
    [
      'wrong sum',
      { shares: { Anh: 500, Bảo: 400 } },
      'The shares add up to $9.00, but the total is $10.00.',
    ],
    ['zero share', { shares: { Anh: 1000, Bảo: 0 } }, "Bảo's share must be more than $0.00."],
  ])('rejects %s', (_, change, error) => {
    expect(buildExpense({ ...groceries, ...change }, 1, PEOPLE)).toEqual({ ok: false, error });
  });
});

function expense(id: number, date: string, description: string, deletedAt?: string): Expense {
  return {
    id,
    date,
    description,
    total: 100,
    payer: 'Anh',
    note: '',
    deletedAt: deletedAt ?? null,
    people: { Anh: { kind: 'share', amount: 100, status: 'Paid' } },
  };
}

describe('liveExpensesNewestFirst', () => {
  it('sorts by date, then by most recently added, and leaves out the trash', () => {
    const expenses = [
      expense(1, '2026-11-02', 'Rent'),
      expense(2, '2026-11-20', 'Pizza'),
      expense(3, '2026-11-02', 'Internet'),
      expense(4, '2026-11-25', 'Deleted', '2026-11-26 10:00'),
    ];
    expect(liveExpensesNewestFirst(expenses).map((e) => e.id)).toEqual([2, 3, 1]);
  });
});

describe('recentDescriptions', () => {
  it('lists each description once, most recently added first, ignoring the trash', () => {
    const expenses = [
      expense(1, '2026-11-01', 'groceries'),
      expense(2, '2026-11-02', 'Rent'),
      expense(3, '2026-10-01', 'Groceries'),
      expense(4, '2026-11-03', 'Pizza', '2026-11-04 09:00'),
      expense(5, '2026-11-03', 'Phở'),
    ];
    expect(recentDescriptions(expenses, 10)).toEqual(['Phở', 'Groceries', 'Rent']);
    expect(recentDescriptions(expenses, 2)).toEqual(['Phở', 'Groceries']);
    expect(recentDescriptions([], 5)).toEqual([]);
  });
});
