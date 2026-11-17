import { describe, expect, it } from 'vitest';
import { formatDollars, parseDollars } from './money';

describe('formatDollars', () => {
  it.each([
    [0, '$0.00'],
    [5, '$0.05'],
    [3490, '$34.90'],
    [234567, '$2,345.67'],
    [123456789, '$1,234,567.89'],
    [-500, '-$5.00'],
    [-59900, '-$599.00'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatDollars(cents)).toBe(expected);
  });
});

describe('parseDollars', () => {
  it.each([
    ['$0.00', 0],
    ['$0.05', 5],
    ['$34.90', 3490],
    ['$2,345.67', 234567],
    ['$2345.67', 234567],
    ['$1,234,567.89', 123456789],
  ])('parses %s as %i cents', (text, expected) => {
    expect(parseDollars(text)).toBe(expected);
  });

  it.each([
    '',
    '34.90',
    '$34.9',
    '$34.900',
    '$34',
    '$1,23.00',
    '$12,34.00',
    '$,123.00',
    '-$5.00',
    '$-5.00',
    ' $1.00',
    '$1.00 ',
    '$1 .00',
  ])('rejects %j', (text) => {
    expect(parseDollars(text)).toBeNull();
  });

  it('round-trips with formatDollars', () => {
    for (const cents of [0, 1, 99, 100, 101, 99999, 100000, 234567, 123456789]) {
      expect(parseDollars(formatDollars(cents))).toBe(cents);
    }
  });
});
