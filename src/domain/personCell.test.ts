import { describe, expect, it } from 'vitest';
import { formatPersonCell, parsePersonCell, type PersonCell } from './personCell';

describe('formatPersonCell', () => {
  it('formats shares and non-participants like the sheet', () => {
    expect(formatPersonCell({ kind: 'share', amount: 3491, status: 'Paid' })).toBe('$34.91 · Paid');
    expect(formatPersonCell({ kind: 'share', amount: 51234, status: 'Not paid' })).toBe(
      '$512.34 · Not paid',
    );
    expect(formatPersonCell({ kind: 'share', amount: 234567, status: 'Paid' })).toBe(
      '$2,345.67 · Paid',
    );
    expect(formatPersonCell({ kind: 'notInvolved' })).toBe('Not involved');
  });
});

describe('parsePersonCell', () => {
  it.each<[string, PersonCell]>([
    ['$12.00 · Paid', { kind: 'share', amount: 1200, status: 'Paid' }],
    ['$3.99 · Not paid', { kind: 'share', amount: 399, status: 'Not paid' }],
    ['$2,345.67 · Not paid', { kind: 'share', amount: 234567, status: 'Not paid' }],
    ['Not involved', { kind: 'notInvolved' }],
  ])('parses %j', (text, expected) => {
    expect(parsePersonCell(text)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ['', 'blank'],
    ['not involved', 'wrong case'],
    ['Not Involved', 'wrong case'],
    ['$12.00 · paid', 'wrong case'],
    ['$12.00 - Paid', 'hyphen instead of middle dot'],
    ['$12.00·Paid', 'no spaces around the dot'],
    ['$12.00 · Paid ', 'trailing space'],
    ['$12 · Paid', 'missing cents'],
    ['12.00 · Paid', 'missing dollar sign'],
    ['$12.00 · Settling', 'unknown status'],
    ['$12.00', 'missing status'],
    ['Paid', 'missing amount'],
    ['$0.00 · Paid', 'zero share'],
  ])('rejects %j (%s)', (text) => {
    const result = parsePersonCell(text);
    expect(result.ok).toBe(false);
  });

  it('round-trips every kind of cell', () => {
    const cells: PersonCell[] = [
      { kind: 'notInvolved' },
      { kind: 'share', amount: 1, status: 'Paid' },
      { kind: 'share', amount: 123456789, status: 'Not paid' },
    ];
    for (const cell of cells) {
      expect(parsePersonCell(formatPersonCell(cell))).toEqual({ ok: true, value: cell });
    }
  });
});
