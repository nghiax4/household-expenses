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

/** Parses text in the sheet's money format ("$1,234.56") into cents, or null if malformed. */
export function parseDollars(text: string): Cents | null {
  const match = DOLLARS_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  const [, dollars = '', cents = ''] = match;
  return Number(dollars.replaceAll(',', '')) * 100 + Number(cents);
}
