import { describe, expect, it } from 'vitest';
import type { ApiResponse } from '../../src/api/protocol';
import type { NewExpense } from '../../src/domain/expense';
import type { SheetCell } from './cells';
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
    setRow: (tab, row, cells) => {
      tabs[tab][row - 1] = cells.map(display);
    },
    setCell: (tab, row, column, cell) => {
      const cells = tabs[tab][row - 1];
      if (!cells) {
        throw new Error(`No row ${row} in ${tab}`);
      }
      cells[column - 1] = display(cell);
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
    [
      'setShareStatuses with a lowercase status',
      body({
        passcode: PASSCODE,
        action: 'setShareStatuses',
        expenseId: 1,
        statuses: { Anh: 'paid' },
      }),
    ],
    [
      'setShareStatuses with a text ID',
      body({
        passcode: PASSCODE,
        action: 'setShareStatuses',
        expenseId: '1',
        statuses: { Anh: 'Paid' },
      }),
    ],
    [
      'editExpense without an expense',
      body({ passcode: PASSCODE, action: 'editExpense', expenseId: 1 }),
    ],
    [
      'deleteExpense with a text ID',
      body({ passcode: PASSCODE, action: 'deleteExpense', expenseId: '1' }),
    ],
    [
      'createSettlement with a text amount',
      body({
        passcode: PASSCODE,
        action: 'createSettlement',
        coversUpToId: 1,
        transfers: [{ from: 'Anh', to: 'Bảo', amount: '5' }],
      }),
    ],
    [
      'createSettlement without transfers',
      body({ passcode: PASSCODE, action: 'createSettlement', coversUpToId: 1 }),
    ],
    [
      'setTransferStatuses with statuses as an object',
      body({
        passcode: PASSCODE,
        action: 'setTransferStatuses',
        settlementId: 1,
        statuses: { Anh: 'Paid' },
      }),
    ],
    [
      'setTransferStatuses with a lowercase status',
      body({
        passcode: PASSCODE,
        action: 'setTransferStatuses',
        settlementId: 1,
        statuses: [{ from: 'Anh', to: 'Bảo', status: 'paid' }],
      }),
    ],
    [
      'cancelSettlement with a text ID',
      body({ passcode: PASSCODE, action: 'cancelSettlement', settlementId: '1' }),
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
      value: {
        people: ['Anh', 'Bảo', 'Chi'],
        expenses: [],
        problems: [],
        templates: [],
        templateProblems: [],
        settlements: [],
      },
    });
  });

  it('includes the templates, and keeps working when a template row is broken', () => {
    const storage = fakeStorage(['Anh', 'Bảo', 'Chi']);
    storage.tabs.Templates.push(['Internet', 'Anh', 'Anh, Bảo', '55'], ['Gas', 'Zed', 'Anh', '']);
    const result = handleRequest(
      body({ passcode: PASSCODE, action: 'listExpenses' }),
      backend(storage),
    ) as ApiResponse<'listExpenses'>;
    expect(result.ok && result.value.templates).toEqual([
      { name: 'Internet', payer: 'Anh', participants: ['Anh', 'Bảo'], defaultAmount: 5500 },
    ]);
    expect(result.ok && result.value.templateProblems).toEqual([
      `Templates row 3: the payer "Zed" doesn't match any person column in Expenses.`,
    ]);
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

describe('handleRequest: marking shares paid', () => {
  // Bảo paid $10.00 for Anh, Bảo and Chi; Dương wasn't involved.
  const PIZZA_ROW = [
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
    'Not involved',
  ];

  function withPizza() {
    const storage = fakeStorage(['Anh', 'Bảo', 'Chi', 'Dương']);
    storage.tabs.Expenses.push([...PIZZA_ROW]);
    return storage;
  }

  const mark = (b: Backend, statuses: Record<string, string>, expenseId = 1) =>
    handleRequest(
      body({ passcode: PASSCODE, action: 'setShareStatuses', expenseId, statuses }),
      b,
    ) as ApiResponse<'setShareStatuses'>;

  it('marks several shares at once, logging each change and returning the tab read back', () => {
    const storage = withPizza();
    const result = mark(backend(storage), { Chi: 'Paid', Anh: 'Paid' });
    expect(storage.tabs.Expenses[1]).toEqual([
      ...PIZZA_ROW.slice(0, 7),
      '$3.33 · Paid',
      '$3.34 · Paid',
      '$3.33 · Paid',
      'Not involved',
    ]);
    // Logged in column order, whatever order they came in.
    expect(storage.tabs.Activity.slice(1)).toEqual([
      ['2026-11-21 14:05', 'Marked paid', '#1 "Pizza": Anh $3.33, Not paid → Paid.'],
      ['2026-11-21 14:05', 'Marked paid', '#1 "Pizza": Chi $3.33, Not paid → Paid.'],
    ]);
    expect(result.ok && result.value.expenses[0]?.people.Chi).toEqual({
      kind: 'share',
      amount: 333,
      status: 'Paid',
    });

    mark(backend(storage), { Chi: 'Not paid' });
    expect(storage.tabs.Expenses[1]?.[9]).toBe('$3.33 · Not paid');
    expect(storage.tabs.Activity.at(-1)).toEqual([
      '2026-11-21 14:05',
      'Marked not paid',
      '#1 "Pizza": Chi $3.33, Paid → Not paid.',
    ]);
  });

  it('writes and logs only the shares that actually change', () => {
    const storage = withPizza();
    expect(mark(backend(storage), { Anh: 'Not paid', Chi: 'Paid' }).ok).toBe(true);
    expect(storage.tabs.Expenses[1]?.[7]).toBe('$3.33 · Not paid');
    expect(storage.tabs.Activity).toHaveLength(2);
  });

  it.each([
    [
      'the payer',
      { Anh: 'Paid', Bảo: 'Paid' },
      1,
      'Bảo paid for "Pizza", so their share is always Paid.',
    ],
    ['someone not involved', { Anh: 'Paid', Dương: 'Paid' }, 1, 'Dương isn\'t part of "Pizza".'],
    [
      'an expense that isn’t there',
      { Anh: 'Paid' },
      9,
      "Expense #9 isn't in the sheet anymore. Reload the list.",
    ],
  ])(
    'refuses %s and writes nothing, not even the valid changes',
    (_, statuses, expenseId, error) => {
      const storage = withPizza();
      expect(mark(backend(storage), statuses, expenseId)).toEqual({ ok: false, error });
      expect(storage.tabs.Expenses[1]).toEqual(PIZZA_ROW);
      expect(storage.tabs.Activity).toHaveLength(1);
    },
  );

  it('refuses when a hand edit put the same ID on two rows, even if one is broken', () => {
    const storage = withPizza();
    storage.tabs.Expenses.splice(1, 0, ['1', 'not a date', 'Copy', '$1.00', 'Anh']);
    expect(mark(backend(storage), { Anh: 'Paid' })).toEqual({
      ok: false,
      error: 'Expense #1 is on rows 2 and 3 of the sheet. Fix that first.',
    });
    expect(storage.tabs.Activity).toHaveLength(1);
  });

  it('refuses a row it can’t read', () => {
    const storage = withPizza();
    storage.tabs.Expenses[1] = [...PIZZA_ROW.slice(0, 7), 'oops', ...PIZZA_ROW.slice(8)];
    expect(mark(backend(storage), { Chi: 'Paid' })).toEqual({
      ok: false,
      error: "Expense #1 can't be read. Fix its row in the sheet first.",
    });
  });
});

describe('handleRequest: editing and deleting', () => {
  // Bảo paid $10.00 for Anh, Bảo and Chi; Anh has paid back, Chi hasn't.
  const PIZZA_ROW = [
    '1',
    '2026-11-20',
    'Pizza',
    '$10.00',
    'Bảo',
    '',
    '',
    '$3.33 · Paid',
    '$3.34 · Paid',
    '$3.33 · Not paid',
    'Not involved',
  ];
  const pizza: NewExpense = {
    date: '2026-11-20',
    description: 'Pizza',
    total: 1000,
    payer: 'Bảo',
    note: '',
    shares: { Anh: 333, Bảo: 334, Chi: 333 },
  };

  function withPizza() {
    const storage = fakeStorage(['Anh', 'Bảo', 'Chi', 'Dương']);
    storage.tabs.Expenses.push([...PIZZA_ROW]);
    return storage;
  }
  const edit = (b: Backend, expense: NewExpense, expenseId = 1) =>
    handleRequest(
      body({ passcode: PASSCODE, action: 'editExpense', expenseId, expense }),
      b,
    ) as ApiResponse<'editExpense'>;
  const remove = (b: Backend, expenseId = 1) =>
    handleRequest(
      body({ passcode: PASSCODE, action: 'deleteExpense', expenseId }),
      b,
    ) as ApiResponse<'deleteExpense'>;

  it('rewrites the row, keeps who had paid back, and logs exactly what changed', () => {
    const storage = withPizza();
    const result = edit(backend(storage), {
      ...pizza,
      total: 1200,
      note: 'with drinks',
      shares: { Anh: 400, Bảo: 400, Chi: 200, Dương: 200 },
    });
    expect(storage.tabs.Expenses[1]).toEqual([
      '1',
      '2026-11-20',
      'Pizza',
      '$12.00',
      'Bảo',
      'with drinks',
      '',
      '$4.00 · Paid',
      '$4.00 · Paid',
      '$2.00 · Not paid',
      '$2.00 · Not paid',
    ]);
    expect(storage.tabs.Activity.slice(1)).toEqual([
      [
        '2026-11-21 14:05',
        'Edited expense',
        '#1 "Pizza": Total $10.00 → $12.00; Note "" → "with drinks"; ' +
          'Anh $3.33 · Paid → $4.00 · Paid; Bảo $3.34 · Paid → $4.00 · Paid; ' +
          'Chi $3.33 · Not paid → $2.00 · Not paid; Dương Not involved → $2.00 · Not paid.',
      ],
    ]);
    expect(result.ok && result.value.expenses[0]?.total).toBe(1200);
  });

  it('writes and logs nothing when the form is saved unchanged', () => {
    const storage = withPizza();
    expect(edit(backend(storage), pizza).ok).toBe(true);
    expect(storage.tabs.Expenses[1]).toEqual(PIZZA_ROW);
    expect(storage.tabs.Activity).toHaveLength(1);
  });

  it('refuses an edit that breaks a rule, writing nothing', () => {
    const storage = withPizza();
    expect(edit(backend(storage), { ...pizza, shares: { Anh: 500 } })).toEqual({
      ok: false,
      error: 'The shares add up to $5.00, but the total is $10.00.',
    });
    expect(storage.tabs.Expenses[1]).toEqual(PIZZA_ROW);
    expect(storage.tabs.Activity).toHaveLength(1);
  });

  it('deletes by filling in "Deleted at", keeping the row, and logs every cell', () => {
    const storage = withPizza();
    const result = remove(backend(storage));
    expect(storage.tabs.Expenses[1]).toEqual([
      ...PIZZA_ROW.slice(0, 6),
      '2026-11-21 14:05',
      ...PIZZA_ROW.slice(7),
    ]);
    expect(storage.tabs.Activity.slice(1)).toEqual([
      [
        '2026-11-21 14:05',
        'Deleted expense',
        '#1 "Pizza" (2026-11-20) $10.00, paid by Bảo. ' +
          'Anh $3.33 · Paid, Bảo $3.34 · Paid, Chi $3.33 · Not paid.',
      ],
    ]);
    expect(result.ok && result.value.expenses[0]?.deletedAt).toBe('2026-11-21 14:05');
  });

  it('refuses to edit, delete or mark a deleted expense', () => {
    const storage = withPizza();
    remove(backend(storage));
    const refused = { ok: false, error: '"Pizza" was deleted.' };
    expect(remove(backend(storage))).toEqual(refused);
    expect(edit(backend(storage), pizza)).toEqual(refused);
    expect(
      handleRequest(
        body({
          passcode: PASSCODE,
          action: 'setShareStatuses',
          expenseId: 1,
          statuses: { Chi: 'Paid' },
        }),
        backend(storage),
      ),
    ).toEqual(refused);
    expect(storage.tabs.Activity).toHaveLength(2);
  });

  it('refuses an expense that isn’t there', () => {
    expect(remove(backend(withPizza()), 9)).toEqual({
      ok: false,
      error: "Expense #9 isn't in the sheet anymore. Reload the list.",
    });
  });
});

describe('handleRequest: settlements', () => {
  // Anh paid $45.00 for Anh, Bảo and Chi; Bảo paid $35.00 for Anh, Bảo and Dương. Net: Anh is
  // owed $15.00 and Bảo $5.00; Chi owes $15.00 and Dương $5.00.
  const GROCERIES = [
    ...['1', '2026-11-20', 'Groceries', '$45.00', 'Anh', '', ''],
    ...['$15.00 · Paid', '$15.00 · Not paid', '$15.00 · Not paid', 'Not involved'],
  ];
  const INTERNET = [
    ...['2', '2026-11-21', 'Internet', '$35.00', 'Bảo', '', ''],
    ...['$15.00 · Not paid', '$15.00 · Paid', 'Not involved', '$5.00 · Not paid'],
  ];
  const TRANSFERS = [
    { from: 'Chi', to: 'Anh', amount: 1500 },
    { from: 'Dương', to: 'Bảo', amount: 500 },
  ];
  const locked = (description: string) => ({
    ok: false,
    error:
      `"${description}" is in settlement #1, so it can’t be changed until every transfer is ` +
      'paid or the settlement is cancelled.',
  });

  function withExpenses(...rows: string[][]) {
    const storage = fakeStorage(['Anh', 'Bảo', 'Chi', 'Dương']);
    storage.tabs.Expenses.push(...rows.map((row) => [...row]));
    return storage;
  }
  // Every action answers with the sheet's data, like listExpenses.
  const send = (b: Backend, request: Record<string, unknown>) =>
    handleRequest(body({ passcode: PASSCODE, ...request }), b) as ApiResponse<'listExpenses'>;
  const create = (b: Backend, transfers: unknown = TRANSFERS, coversUpToId = 2) =>
    send(b, { action: 'createSettlement', coversUpToId, transfers });
  const markTransfers = (b: Backend, statuses: unknown[], settlementId = 1) =>
    send(b, { action: 'setTransferStatuses', settlementId, statuses });
  const cancel = (b: Backend, settlementId = 1) =>
    send(b, { action: 'cancelSettlement', settlementId });

  it('saves the previewed transfers, one row each, and logs them', () => {
    const storage = withExpenses(GROCERIES, INTERNET);
    const result = create(backend(storage));
    expect(storage.tabs.Settlements.slice(1)).toEqual([
      ['1', '2026-11-21 14:05', '2', 'Chi', 'Anh', '$15.00', 'Not paid', '', ''],
      ['1', '2026-11-21 14:05', '2', 'Dương', 'Bảo', '$5.00', 'Not paid', '', ''],
    ]);
    expect(storage.tabs.Activity.slice(1)).toEqual([
      [
        '2026-11-21 14:05',
        'Created settlement',
        '#1, covering expenses up to #2: Chi → Anh $15.00; Dương → Bảo $5.00.',
      ],
    ]);
    expect(result.ok && result.value.settlements).toEqual([
      {
        id: 1,
        createdAt: '2026-11-21 14:05',
        coversUpToId: 2,
        lines: TRANSFERS.map((t) => ({ ...t, status: 'Not paid', paidAt: null })),
        cancelledAt: null,
      },
    ]);
    // Creating doesn't touch the shares: they stay Not paid until the settlement closes.
    expect(storage.tabs.Expenses.slice(1)).toEqual([GROCERIES, INTERNET]);
  });

  it.each([
    ['different transfers', [TRANSFERS[0]], 2],
    ['a different last expense', TRANSFERS, 1],
  ])('refuses a preview that no longer matches (%s), writing nothing', (_, transfers, upTo) => {
    const storage = withExpenses(GROCERIES, INTERNET);
    const result = create(backend(storage), transfers, upTo);
    expect(result.ok ? 'saved' : result.error).toMatch(/^Something changed since you opened this/);
    expect(storage.tabs.Settlements).toHaveLength(1);
    expect(storage.tabs.Activity).toHaveLength(1);
  });

  it('refuses when nothing is unpaid, while one is open, or with an unreadable Expenses row', () => {
    const allPaid = [
      ...GROCERIES.slice(0, 7),
      ...['$15.00 · Paid', '$15.00 · Paid', '$15.00 · Paid', 'Not involved'],
    ];
    expect(create(backend(withExpenses(allPaid)), [], 1)).toEqual({
      ok: false,
      error: 'Nothing to settle: every share has been paid back.',
    });

    const storage = withExpenses(GROCERIES, INTERNET);
    create(backend(storage));
    expect(create(backend(storage))).toEqual({
      ok: false,
      error: 'Settlement #1 is still open. Finish or cancel it first.',
    });

    const broken = withExpenses(GROCERIES, INTERNET, ['3', 'not a date', 'Oops', '$1.00', 'Anh']);
    const result = create(backend(broken));
    expect(result.ok ? 'saved' : result.error).toMatch(
      /^Some rows in the Expenses tab can’t be read/,
    );
    expect(broken.tabs.Settlements).toHaveLength(1);
  });

  it('locks the covered expenses while open, but not newer ones', () => {
    const storage = withExpenses(GROCERIES, INTERNET);
    const b = backend(storage);
    create(b);
    const groceries: NewExpense = {
      date: '2026-11-20',
      description: 'Groceries',
      total: 4500,
      payer: 'Anh',
      note: 'changed',
      shares: { Anh: 1500, Bảo: 1500, Chi: 1500 },
    };
    expect(send(b, { action: 'editExpense', expenseId: 1, expense: groceries })).toEqual(
      locked('Groceries'),
    );
    expect(send(b, { action: 'deleteExpense', expenseId: 2 })).toEqual(locked('Internet'));
    expect(
      send(b, { action: 'setShareStatuses', expenseId: 1, statuses: { Bảo: 'Paid' } }),
    ).toEqual(locked('Groceries'));
    expect(storage.tabs.Expenses.slice(1)).toEqual([GROCERIES, INTERNET]);

    // Expense #3 comes after the settlement, so it belongs to the next one and stays editable.
    expect(send(b, { action: 'addExpense', expense: groceries }).ok).toBe(true);
    expect(send(b, { action: 'deleteExpense', expenseId: 3 }).ok).toBe(true);
  });

  it('ticks transfers off one by one, and closing marks every covered share Paid', () => {
    const storage = withExpenses(GROCERIES, INTERNET);
    const b = backend(storage);
    create(b);

    markTransfers(b, [{ from: 'Chi', to: 'Anh', status: 'Paid' }]);
    expect(storage.tabs.Settlements[1]?.slice(6)).toEqual(['Paid', '2026-11-21 14:05', '']);
    expect(storage.tabs.Expenses.slice(1)).toEqual([GROCERIES, INTERNET]);
    expect(storage.tabs.Activity.at(-1)).toEqual([
      '2026-11-21 14:05',
      'Marked transfer paid',
      'Settlement #1: Chi → Anh $15.00, Not paid → Paid.',
    ]);

    const closed = markTransfers(b, [
      { from: 'Chi', to: 'Anh', status: 'Paid' },
      { from: 'Dương', to: 'Bảo', status: 'Paid' },
    ]);
    expect(storage.tabs.Expenses.slice(1)).toEqual([
      [
        ...GROCERIES.slice(0, 7),
        ...['$15.00 · Paid', '$15.00 · Paid', '$15.00 · Paid', 'Not involved'],
      ],
      [
        ...INTERNET.slice(0, 7),
        ...['$15.00 · Paid', '$15.00 · Paid', 'Not involved', '$5.00 · Paid'],
      ],
    ]);
    // Chi's line was already Paid, so only Dương's is logged.
    expect(storage.tabs.Activity.slice(-2)).toEqual([
      [
        '2026-11-21 14:05',
        'Marked transfer paid',
        'Settlement #1: Dương → Bảo $5.00, Not paid → Paid.',
      ],
      [
        '2026-11-21 14:05',
        'Closed settlement',
        '#1: every transfer is paid, so these shares were marked Paid: ' +
          '#1 "Groceries": Bảo $15.00, Chi $15.00; #2 "Internet": Anh $15.00, Dương $5.00.',
      ],
    ]);
    const lines = closed.ok ? closed.value.settlements[0]?.lines : [];
    expect(lines?.map((line) => line.status)).toEqual(['Paid', 'Paid']);

    // Closed: the lines can't be unticked, and the expenses are unlocked.
    expect(markTransfers(b, [{ from: 'Chi', to: 'Anh', status: 'Not paid' }])).toEqual({
      ok: false,
      error: 'Settlement #1 is already closed: every transfer was paid.',
    });
    expect(send(b, { action: 'deleteExpense', expenseId: 1 }).ok).toBe(true);
  });

  it('unticks a transfer, and refuses an unknown one without writing anything', () => {
    const storage = withExpenses(GROCERIES, INTERNET);
    const b = backend(storage);
    create(b);
    markTransfers(b, [{ from: 'Chi', to: 'Anh', status: 'Paid' }]);
    markTransfers(b, [{ from: 'Chi', to: 'Anh', status: 'Not paid' }]);
    expect(storage.tabs.Settlements[1]?.slice(6)).toEqual(['Not paid', '', '']);

    const activityRows = storage.tabs.Activity.length;
    expect(
      markTransfers(b, [
        { from: 'Dương', to: 'Bảo', status: 'Paid' },
        { from: 'Anh', to: 'Chi', status: 'Paid' },
      ]),
    ).toEqual({ ok: false, error: 'Settlement #1 has no transfer from Anh to Chi.' });
    expect(storage.tabs.Settlements[2]?.slice(6)).toEqual(['Not paid', '', '']);
    expect(storage.tabs.Activity).toHaveLength(activityRows);
    expect(markTransfers(b, [], 7)).toEqual({
      ok: false,
      error: "Settlement #7 isn't in the sheet anymore. Reload the app.",
    });
  });

  it('cancels only while no transfer is ticked, unlocking the expenses', () => {
    const storage = withExpenses(GROCERIES, INTERNET);
    const b = backend(storage);
    create(b);
    markTransfers(b, [{ from: 'Chi', to: 'Anh', status: 'Paid' }]);
    expect(cancel(b)).toEqual({
      ok: false,
      error: 'Settlement #1 can’t be cancelled while transfers are marked paid. Untick them first.',
    });
    markTransfers(b, [{ from: 'Chi', to: 'Anh', status: 'Not paid' }]);

    const result = cancel(b);
    expect(storage.tabs.Settlements.slice(1).map((row) => row[8])).toEqual([
      '2026-11-21 14:05',
      '2026-11-21 14:05',
    ]);
    expect(storage.tabs.Activity.at(-1)).toEqual([
      '2026-11-21 14:05',
      'Cancelled settlement',
      '#1 (covering expenses up to #2): Chi → Anh $15.00; Dương → Bảo $5.00.',
    ]);
    expect(result.ok && result.value.settlements[0]?.cancelledAt).toBe('2026-11-21 14:05');
    expect(cancel(b)).toEqual({ ok: false, error: 'Settlement #1 was already cancelled.' });
    expect(markTransfers(b, [])).toEqual({ ok: false, error: 'Settlement #1 was cancelled.' });

    // Unlocked again. With Bảo's share on Groceries now paid, the next settlement differs and
    // takes the next ID.
    const marked = send(b, {
      action: 'setShareStatuses',
      expenseId: 1,
      statuses: { Bảo: 'Paid' },
    });
    expect(marked.ok).toBe(true);
    create(b, [
      { from: 'Chi', to: 'Bảo', amount: 1500 },
      { from: 'Dương', to: 'Bảo', amount: 500 },
    ]);
    expect(storage.tabs.Settlements.slice(3).map((row) => row.slice(0, 6))).toEqual([
      ['2', '2026-11-21 14:05', '2', 'Chi', 'Bảo', '$15.00'],
      ['2', '2026-11-21 14:05', '2', 'Dương', 'Bảo', '$5.00'],
    ]);
  });

  it('marks shares Paid right away when they cancel out, without saving a settlement', () => {
    // Anh paid $5.00 for Bảo, and Bảo paid $5.00 for Anh.
    const storage = withExpenses(
      [
        ...['1', '2026-11-20', 'Coffee', '$5.00', 'Anh', '', ''],
        ...['Not involved', '$5.00 · Not paid', 'Not involved', 'Not involved'],
      ],
      [
        ...['2', '2026-11-21', 'Tea', '$5.00', 'Bảo', '', ''],
        ...['$5.00 · Not paid', 'Not involved', 'Not involved', 'Not involved'],
      ],
    );
    expect(create(backend(storage), []).ok).toBe(true);
    expect(storage.tabs.Settlements).toHaveLength(1);
    expect(storage.tabs.Expenses.slice(1).map((row) => row.slice(7, 9))).toEqual([
      ['Not involved', '$5.00 · Paid'],
      ['$5.00 · Paid', 'Not involved'],
    ]);
    expect(storage.tabs.Activity.at(-1)).toEqual([
      '2026-11-21 14:05',
      'Settled without transfers',
      'Expenses up to #2: the unpaid shares cancelled out, so nobody had to send money. ' +
        'Marked Paid: #1 "Coffee": Bảo $5.00; #2 "Tea": Anh $5.00.',
    ]);
  });

  it('fails the whole load when the Settlements tab is broken, since locks depend on it', () => {
    const storage = withExpenses(GROCERIES);
    storage.tabs.Settlements.push([
      '1',
      '2026-11-21 14:05',
      '1',
      'Zed',
      'Anh',
      '$1.00',
      'Not paid',
    ]);
    expect(send(backend(storage), { action: 'listExpenses' })).toEqual({
      ok: false,
      error:
        'Settlements row 2: "Zed" doesn\'t match any person column in Expenses. Fix it in the sheet.',
    });
  });
});
