import { describe, expect, it } from 'vitest';
import { TAB_HEADERS } from './schema';
import { nextSettlementId, readSettlementsTab, settlementRows } from './settlementsTab';

// Made-up people (the repo is public), in person-column order.
const PEOPLE = ['Anh', 'Bảo', 'Chi'];
const HEADER = [...TAB_HEADERS.Settlements];
const LINE_1 = [
  '1',
  '2026-11-20 09:00',
  '4',
  'Bảo',
  'Anh',
  '$12.00',
  'Paid',
  '2026-11-21 08:00',
  '',
];
const LINE_2 = ['1', '2026-11-20 09:00', '4', 'Chi', 'Anh', '$1,000.50', 'Not paid', '', ''];

describe('readSettlementsTab', () => {
  it('groups the rows of each settlement, oldest first, and skips blank rows', () => {
    const cancelled = ['3', '2026-11-22 10:00', '9', 'Anh', 'Chi', '$2.00', 'Not paid', '', 'x'];
    expect(readSettlementsTab([HEADER, cancelled, LINE_1, ['', ''], LINE_2], PEOPLE)).toEqual({
      ok: true,
      value: [
        {
          id: 1,
          createdAt: '2026-11-20 09:00',
          coversUpToId: 4,
          lines: [
            { from: 'Bảo', to: 'Anh', amount: 1200, status: 'Paid', paidAt: '2026-11-21 08:00' },
            { from: 'Chi', to: 'Anh', amount: 100050, status: 'Not paid', paidAt: null },
          ],
          cancelledAt: null,
        },
        {
          id: 3,
          createdAt: '2026-11-22 10:00',
          coversUpToId: 9,
          lines: [{ from: 'Anh', to: 'Chi', amount: 200, status: 'Not paid', paidAt: null }],
          cancelledAt: 'x',
        },
      ],
    });
  });

  it('reads back exactly what it writes', () => {
    const read = readSettlementsTab([HEADER, LINE_1, LINE_2], PEOPLE);
    expect(read.ok).toBe(true);
    const settlements = read.ok ? read.value : [];
    // Shown the way Sheets would: apostrophes hidden, money with its number format.
    const shown = settlements
      .flatMap(settlementRows)
      .map((row) =>
        row.map(({ value, numberFormat }) =>
          numberFormat ? `$${Number(value).toFixed(2)}` : String(value).replace(/^'/, ''),
        ),
      );
    expect(readSettlementsTab([HEADER, ...shown], PEOPLE)).toEqual(read);
  });

  it.each([
    [
      'a text ID',
      ['x', ...LINE_1.slice(1)],
      'the Settlement ID "x" isn\'t a whole number above 0.',
    ],
    ['no creation time', [LINE_1[0]!, '', ...LINE_1.slice(2)], '"Created at" is empty.'],
    [
      'a bad expense number',
      [...LINE_1.slice(0, 2), '#4', ...LINE_1.slice(3)],
      '"Covers up to expense #" is "#4", not a whole number above 0.',
    ],
    [
      'an unknown person',
      [...LINE_1.slice(0, 4), 'Zed', ...LINE_1.slice(5)],
      '"Zed" doesn\'t match any person column in Expenses.',
    ],
    [
      'someone paying themself',
      [...LINE_1.slice(0, 4), 'Bảo', ...LINE_1.slice(5)],
      "Bảo can't pay themself.",
    ],
    [
      'a zero amount',
      [...LINE_1.slice(0, 5), '$0.00', ...LINE_1.slice(6)],
      'the amount "$0.00" isn\'t an amount like $12.34 above $0.00.',
    ],
    [
      'a lowercase status',
      [...LINE_1.slice(0, 6), 'paid', ...LINE_1.slice(7)],
      'Paid is "paid", but must be "Paid" or "Not paid".',
    ],
  ])('refuses %s, naming the row', (_, row, reason) => {
    expect(readSettlementsTab([HEADER, row], PEOPLE)).toEqual({
      ok: false,
      error: `Settlements row 2: ${reason} Fix it in the sheet.`,
    });
  });

  it('refuses rows of one settlement that disagree, or repeat a transfer', () => {
    const otherTime = [LINE_2[0]!, '2026-11-20 09:01', ...LINE_2.slice(2)];
    expect(readSettlementsTab([HEADER, LINE_1, otherTime], PEOPLE)).toEqual({
      ok: false,
      error:
        'Settlements row 3: settlement #1\'s "Created at" doesn\'t match its other rows. ' +
        'Fix it in the sheet.',
    });
    const cancelledOnce = [...LINE_2.slice(0, 8), '2026-11-22 10:00'];
    expect(readSettlementsTab([HEADER, LINE_1, cancelledOnce], PEOPLE).ok).toBe(false);
    expect(readSettlementsTab([HEADER, LINE_1, LINE_1], PEOPLE)).toEqual({
      ok: false,
      error:
        'Settlements row 3: settlement #1 already has a transfer from Bảo to Anh. ' +
        'Fix it in the sheet.',
    });
  });

  it('refuses two open settlements, and a changed header', () => {
    const second = ['2', ...LINE_2.slice(1)];
    expect(readSettlementsTab([HEADER, LINE_2, second], PEOPLE)).toEqual({
      ok: false,
      error:
        'Settlements #1 and #2 are still open, but only one can be open at a time. ' +
        'Fix the Settlements tab in the sheet.',
    });
    expect(readSettlementsTab([HEADER.slice(0, 8)], PEOPLE).ok).toBe(false);
  });
});

describe('nextSettlementId', () => {
  it('continues after the highest ID, ignoring text', () => {
    expect(nextSettlementId([HEADER])).toBe(1);
    expect(nextSettlementId([HEADER, LINE_1, ['7'], ['oops']])).toBe(8);
  });
});
