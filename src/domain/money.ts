import { fail, ok, type Result } from './result';

/**
 * An amount of money in whole US cents. Always an integer, so sums are exact
 * ($0.10 + $0.20 is 30, never 0.30000000000000004).
 */
export type Cents = number;

/** A person's full name, as in the sheet's column headers. Names are unique keys. */
export type PersonName = string;

/** Adds up whole numbers, such as cents or basis points. */
export function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

/** Formats cents the way the sheet shows money: 123456 → "$1,234.56", -500 → "-$5.00". */
export function formatDollars(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100).toLocaleString('en-US');
  const remainder = String(absolute % 100).padStart(2, '0');
  return `${sign}$${dollars}.${remainder}`;
}

// "$1,234.56" or "$1234.56": a dollar sign, correctly grouped digits, exactly two decimals.
const DOLLARS_PATTERN = /^\$(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})$/;

/**
 * Reads an amount someone typed: "12", "12.5", ".99", "$1,234.50". A single comma with one or
 * two digits after it ("12,50") is a decimal point, because the iPhone keypad shows "," instead
 * of "." when the phone's region writes decimals that way (Vietnam, for example).
 */
export function parseTypedAmount(text: string): Result<Cents> {
  const trimmed = text.trim().replace(/^\$/, '').trim();
  if (trimmed === '') {
    return fail('Enter an amount.');
  }
  const normalized = /^\d+,\d{1,2}$/.test(trimmed)
    ? trimmed.replace(',', '.')
    : trimmed.replaceAll(',', '');

  const match = /^(\d*)(?:\.(\d*))?$/.exec(normalized);
  const [, dollars = '', cents = ''] = match ?? [];
  if (!match || dollars + cents === '') {
    return fail(`"${text.trim()}" isn't an amount. Type it like 12.50.`);
  }
  if (cents.length > 2) {
    return fail('Use at most 2 decimals (cents).');
  }
  const amount = Number(dollars || '0') * 100 + Number(cents.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount)) {
    return fail('That amount is too large.');
  }
  if (amount === 0) {
    return fail('The amount must be more than $0.00.');
  }
  return ok(amount);
}

/** Parses text in the sheet's money format ("$1,234.56") into cents, or null if malformed. */
export function parseDollars(text: string): Cents | null {
  const match = DOLLARS_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  const [, dollars = '', cents = ''] = match;
  return Number(dollars.replaceAll(',', '')) * 100 + Number(cents);
}
