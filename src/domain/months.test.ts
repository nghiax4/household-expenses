import { describe, expect, it } from 'vitest';
import type { Expense } from './expense';
import { groupByMonth, owingCount } from './months';

// Made-up people and amounts (the repo is public).
const expense = (id: number, date: string, total: number): Expense => ({
  id,
  date,
  description: `Expense ${id}`,
  total,
  payer: 'Anh',
  note: '',
  tags: [],
  deletedAt: null,
  people: {
    Anh: { kind: 'share', amount: total / 2, status: 'Paid' },
    Bảo: { kind: 'share', amount: total / 2, status: 'Not paid' },
  },
});

describe('groupByMonth', () => {
  it('groups a newest-first list by month, keeping its order, with each month’s total', () => {
    const groups = groupByMonth([
      expense(3, '2026-11-20', 1000),
      expense(2, '2026-11-02', 500),
      expense(1, '2026-10-31', 200),
      expense(4, '2025-11-15', 100),
    ]);
    expect(groups.map((g) => [g.month, g.expenses.map((e) => e.id), g.total])).toEqual([
      ['2026-11', [3, 2], 1500],
      ['2026-10', [1], 200],
      ['2025-11', [4], 100],
    ]);
  });

  it('gives nothing for no expenses', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('owingCount', () => {
  it('counts the people still owing, never the payer', () => {
    const base = expense(1, '2026-11-20', 900);
    expect(owingCount(base)).toBe(1);
    expect(
      owingCount({
        ...base,
        people: {
          Anh: { kind: 'share', amount: 300, status: 'Not paid' },
          Bảo: { kind: 'share', amount: 300, status: 'Paid' },
          Chi: { kind: 'share', amount: 300, status: 'Not paid' },
          Dương: { kind: 'notInvolved' },
        },
      }),
    ).toBe(1);
  });
});
