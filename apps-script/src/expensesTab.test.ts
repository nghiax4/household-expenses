import { describe, expect, it } from 'vitest';
import type { Expense } from '../../src/domain/expense';
import { expenseRow, nextExpenseId, readExpensesTab } from './expensesTab';
import { TAB_HEADERS } from './schema';

// Made-up people and amounts (the repo is public).
const HEADER = [...TAB_HEADERS.Expenses, 'Anh', 'Bảo', 'Chi'];
const NI = 'Not involved';
const GOOD_ROW = [
  '1',
  '2026-11-20',
  'Pizza',
  '$10.00',
  'Bảo',
  '',
  '',
  '$3.33 · Not paid',
  '$6.67 · Paid',
  NI,
];

describe('readExpensesTab', () => {
  it('reads people from the header and expenses from the rows', () => {
    const result = readExpensesTab([
      HEADER,
      GOOD_ROW,
      [
        '2',
        '2026-11-21',
        'Rent',
        '$1,200.00',
        'Anh',
        'Nov',
        '2026-11-22 09:00',
        '$1,200.00 · Paid',
        NI,
        NI,
      ],
    ]);
    expect(result).toEqual({
      ok: true,
      value: {
        people: ['Anh', 'Bảo', 'Chi'],
        problems: [],
        expenses: [
          {
            id: 1,
            date: '2026-11-20',
            description: 'Pizza',
            total: 1000,
            payer: 'Bảo',
            note: '',
            deletedAt: null,
            people: {
              Anh: { kind: 'share', amount: 333, status: 'Not paid' },
              Bảo: { kind: 'share', amount: 667, status: 'Paid' },
              Chi: { kind: 'notInvolved' },
            },
          },
          {
            id: 2,
            date: '2026-11-21',
            description: 'Rent',
            total: 120000,
            payer: 'Anh',
            note: 'Nov',
            deletedAt: '2026-11-22 09:00',
            people: {
              Anh: { kind: 'share', amount: 120000, status: 'Paid' },
              Bảo: { kind: 'notInvolved' },
              Chi: { kind: 'notInvolved' },
            },
          },
        ],
      },
    });
  });

  it('ignores blank rows and empty trailing header cells', () => {
    const result = readExpensesTab([[...HEADER, '', ''], ['', '', ''], GOOD_ROW]);
    expect(result.ok && result.value.people).toEqual(['Anh', 'Bảo', 'Chi']);
    expect(result.ok && result.value.expenses).toHaveLength(1);
  });

  it('reports each broken row with its sheet row number, and keeps the good ones', () => {
    const broken = (column: number, text: string) =>
      GOOD_ROW.map((cell, i) => (i === column ? text : cell));
    const result = readExpensesTab([
      HEADER,
      broken(0, 'x'),
      broken(1, '11/20/2026'),
      broken(2, ''),
      broken(3, '10'),
      broken(4, 'Zed'),
      broken(8, ''),
      broken(3, '$11.00'),
      GOOD_ROW,
      GOOD_ROW,
    ]);
    expect(result.ok && result.value.problems).toEqual([
      'Row 2: the ID "x" isn\'t a whole number above 0.',
      'Row 3: the date "11/20/2026" isn\'t a date written like 2026-11-21.',
      'Row 4: the description is empty.',
      'Row 5: the total "10" isn\'t an amount like $12.34 above $0.00.',
      'Row 6: the payer "Zed" doesn\'t match any person column.',
      'Row 7: Bảo\'s cell: The cell is blank. It should be an amount with a status, or "Not involved".',
      'Row 8: the shares add up to $10.00, but the total is $11.00.',
      'Row 10: ID 1 is already used by an earlier row.',
    ]);
    expect(result.ok && result.value.expenses.map((e) => e.id)).toEqual([1]);
  });

  it.each([
    ['changed fixed headers', ['ID', 'Day', ...HEADER.slice(2)]],
    ['no people', [...TAB_HEADERS.Expenses]],
    ['a nameless person column', [...TAB_HEADERS.Expenses, 'Anh', '', 'Chi']],
    ['a person twice', [...TAB_HEADERS.Expenses, 'Anh', 'Anh']],
    ['no header at all', undefined],
  ])('fails on a broken header (%s)', (_, header) => {
    expect(readExpensesTab(header ? [header] : []).ok).toBe(false);
  });
});

describe('nextExpenseId', () => {
  it('is one more than the highest whole-number ID', () => {
    expect(nextExpenseId([HEADER])).toBe(1);
    expect(nextExpenseId([HEADER, ['3'], ['x'], ['12'], [''], ['2']])).toBe(13);
  });
});

describe('expenseRow', () => {
  it('writes text as literal text, the date and total with number formats', () => {
    const expense: Expense = {
      id: 4,
      date: '2026-11-21',
      description: '=1/2 pizza',
      total: 123456,
      payer: 'Anh',
      note: '',
      deletedAt: null,
      people: {
        Anh: { kind: 'share', amount: 123455, status: 'Paid' },
        Chi: { kind: 'share', amount: 1, status: 'Not paid' },
      },
    };
    expect(expenseRow(expense, ['Anh', 'Bảo', 'Chi'])).toEqual([
      { value: 4 },
      { value: '2026-11-21', numberFormat: 'yyyy-mm-dd' },
      { value: "'=1/2 pizza" },
      { value: 1234.56, numberFormat: '$#,##0.00' },
      { value: "'Anh" },
      { value: '' },
      { value: '' },
      { value: "'$1,234.55 · Paid" },
      { value: "'Not involved" },
      { value: "'$0.01 · Not paid" },
    ]);
  });
});
