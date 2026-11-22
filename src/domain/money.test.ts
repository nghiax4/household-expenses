import { describe, expect, it } from 'vitest';
import { formatDollars, formatTypedAmount, parseDollars, parseTypedAmount } from './money';

describe('parseTypedAmount', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['12.', 1200],
    ['.99', 99],
    ['0.01', 1],
    ['  $42.10 ', 4210],
    ['$ 7', 700],
    ['1,234.56', 123456],
    ['1,234', 123400],
    ['12,5', 1250],
    ['12,50', 1250],
  ])('reads %j as %i cents', (text, cents) => {
    expect(parseTypedAmount(text)).toEqual({ ok: true, value: cents });
  });

  it.each([
    ['', 'Enter an amount.'],
    ['  ', 'Enter an amount.'],
    ['$', 'Enter an amount.'],
    ['.', '"." isn\'t an amount. Type it like 12.50.'],
    ['abc', '"abc" isn\'t an amount. Type it like 12.50.'],
    ['-5', '"-5" isn\'t an amount. Type it like 12.50.'],
    ['1.2.3', '"1.2.3" isn\'t an amount. Type it like 12.50.'],
    ['12.345', 'Use at most 2 decimals (cents).'],
    ['0', 'The amount must be more than $0.00.'],
    ['0.00', 'The amount must be more than $0.00.'],
    ['99999999999999999', 'That amount is too large.'],
  ])('rejects %j', (text, error) => {
    expect(parseTypedAmount(text)).toEqual({ ok: false, error });
  });
});

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

describe('formatTypedAmount', () => {
  it.each([
    [4000, '40.00'],
    [5, '0.05'],
    [123450, '1,234.50'],
  ])('formats %i as %j, which parseTypedAmount reads back', (cents, text) => {
    expect(formatTypedAmount(cents)).toBe(text);
    expect(parseTypedAmount(text)).toEqual({ ok: true, value: cents });
  });
});
