import { describe, expect, it } from 'vitest';
import type { ApiResponse } from '../../src/api/protocol';
import type { NewExpense } from '../../src/domain/expense';
import type { SheetCell } from './expensesTab';
import { handleRequest, type Backend, type SheetStorage } from './handleRequest';
import { TAB_HEADERS, type TabName } from './schema';

const body = (value: unknown) => JSON.stringify(value);
const PASSCODE = 'abc123';

/**
 * An in-memory spreadsheet that displays cells roughly the way Sheets would: hidden leading
 * apostrophes, and the number formats the backend uses.
 */
function fakeStorage(people: string[]): SheetStorage & { tabs: Record<TabName, string[][]> } {
  const tabs: Record<TabName, string[][]> = {
    Expenses: [[...TAB_HEADERS.Expenses, ...people]],
    Settlements: [[...TAB_HEADERS.Settlements]],
    Templates: [[...TAB_HEADERS.Templates]],
    Activity: [[...TAB_HEADERS.Activity]],
    Ideas: [[...TAB_HEADERS.Ideas]],
  };
  const display = ({ value, numberFormat }: SheetCell): string => {
    if (numberFormat === '$#,##0.00' && typeof value === 'number') {
      return `$${value.toFixed(2)}`;
    }
    return String(value).replace(/^'/, '');
  };
  return {
    tabs,
    readTab: (tab) => tabs[tab].map((row) => [...row]),
    appendRow: (tab, cells) => {
      tabs[tab].push(cells.map(display));
    },
  };
}

function backend(storage = fakeStorage(['Anh', 'Bảo', 'Chi'])): Backend {
  return { passcode: PASSCODE, storage, now: () => '2026-11-21 14:05' };
}

describe('handleRequest: passcode and request shape', () => {
  it('accepts the right passcode', () => {
    expect(handleRequest(body({ passcode: PASSCODE, action: 'checkPasscode' }), backend())).toEqual(
      { ok: true, value: {} },
    );
  });

  it('rejects a wrong passcode, including different case', () => {
    for (const passcode of ['nope', 'ABC123']) {
      expect(handleRequest(body({ passcode, action: 'listExpenses' }), backend())).toEqual({
        ok: false,
        error: 'Wrong passcode.',
      });
    }
  });

  it('refuses everything until a passcode has been saved', () => {
    for (const stored of [null, '']) {
      const result = handleRequest(body({ passcode: '', action: 'checkPasscode' }), {
        ...backend(),
        passcode: stored,
      });
      expect(result.ok).toBe(false);
    }
  });

  it.each([
    ['not JSON', '{oops'],
    ['empty body', ''],
    ['missing passcode', body({ action: 'checkPasscode' })],
    ['passcode not a string', body({ passcode: 123, action: 'checkPasscode' })],
    ['unknown action', body({ passcode: PASSCODE, action: 'deleteEverything' })],
    ['not an object', body(PASSCODE)],
    ['addExpense without an expense', body({ passcode: PASSCODE, action: 'addExpense' })],
    [
      'addExpense with a text total',
      body({
        passcode: PASSCODE,
        action: 'addExpense',
        expense: {
          date: '2026-11-21',
          description: 'x',
          total: '10',
          payer: 'Anh',
          note: '',
          shares: {},
        },
      }),
    ],
    [
      'addExpense with a text share',
      body({
        passcode: PASSCODE,
        action: 'addExpense',
        expense: {
          date: '2026-11-21',
          description: 'x',
          total: 10,
          payer: 'Anh',
          note: '',
          shares: { Anh: '10' },
        },
      }),
    ],
  ])('rejects a malformed request (%s)', (_, raw) => {
    expect(handleRequest(raw, backend())).toEqual({
      ok: false,
      error: 'The request was malformed.',
    });
  });
});

describe('handleRequest: expenses', () => {
  const pizza: NewExpense = {
    date: '2026-11-20',
    description: 'Pizza',
    total: 1000,
    payer: 'Bảo',
    note: '',
    shares: { Anh: 333, Bảo: 334, Chi: 333 },
  };
  // The handler's return type is general; addExpense always answers with the tab's data.
  const add = (b: Backend, expense: NewExpense) =>
    handleRequest(
      body({ passcode: PASSCODE, action: 'addExpense', expense }),
      b,
    ) as ApiResponse<'addExpense'>;

  it('lists an empty tab', () => {
    expect(handleRequest(body({ passcode: PASSCODE, action: 'listExpenses' }), backend())).toEqual({
      ok: true,
      value: { people: ['Anh', 'Bảo', 'Chi'], expenses: [], problems: [] },
    });
  });

  it('adds expenses with increasing IDs, logs each one, and returns the tab read back', () => {
    const storage = fakeStorage(['Anh', 'Bảo', 'Chi']);
    const b = backend(storage);
    add(b, pizza);
    const result = add(b, {
      ...pizza,
      description: 'Phở',
      total: 500,
      payer: 'Anh',
      note: 'lunch',
      shares: { Anh: 500 },
    });

    expect(storage.tabs.Expenses.slice(1)).toEqual([
      [
        '1',
        '2026-11-20',
        'Pizza',
        '$10.00',
        'Bảo',
        '',
        '',
        '$3.33 · Not paid',
        '$3.34 · Paid',
        '$3.33 · Not paid',
      ],
      [
        '2',
        '2026-11-20',
        'Phở',
        '$5.00',
        'Anh',
        'lunch',
        '',
        '$5.00 · Paid',
        'Not involved',
        'Not involved',
      ],
    ]);
    expect(storage.tabs.Activity.slice(1)).toEqual([
      [
        '2026-11-21 14:05',
        'Added expense',
        '#1 "Pizza" (2026-11-20) $10.00, paid by Bảo. Split: Anh $3.33, Bảo $3.34, Chi $3.33.',
      ],
      [
        '2026-11-21 14:05',
        'Added expense',
        '#2 "Phở" (2026-11-20) $5.00, paid by Anh. Split: Anh $5.00. Note: "lunch"',
      ],
    ]);
    expect(result.ok && result.value.expenses.map((e) => [e.id, e.description])).toEqual([
      [1, 'Pizza'],
      [2, 'Phở'],
    ]);
  });

  it('writes nothing when the expense breaks a rule', () => {
    const storage = fakeStorage(['Anh', 'Bảo', 'Chi']);
    expect(add(backend(storage), { ...pizza, shares: { Anh: 500, Zed: 500 } })).toEqual({
      ok: false,
      error: '"Zed" isn\'t one of the household\'s people.',
    });
    expect(storage.tabs.Expenses).toHaveLength(1);
    expect(storage.tabs.Activity).toHaveLength(1);
  });

  it('continues after the highest ID, even one on a broken row', () => {
    const storage = fakeStorage(['Anh']);
    storage.tabs.Expenses.push(['7', 'not a date', 'Old', '$1.00', 'Anh', '', '', '$1.00 · Paid']);
    const result = add(backend(storage), { ...pizza, payer: 'Anh', shares: { Anh: 1000 } });
    expect(storage.tabs.Expenses[2]?.[0]).toBe('8');
    expect(result.ok && result.value.problems).toEqual([
      'Row 2: the date "not a date" isn\'t a date written like 2026-11-21.',
    ]);
  });
});
