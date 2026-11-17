import { formatDollars, parseDollars, type Cents } from './money';
import { fail, ok, type Result } from './result';

export type ShareStatus = 'Paid' | 'Not paid';

/** What one person's cell on an expense row says. */
export type PersonCell =
  { kind: 'notInvolved' } | { kind: 'share'; amount: Cents; status: ShareStatus };

export const NOT_INVOLVED_TEXT = 'Not involved';

// The separator is a middle dot (U+00B7) with a space on each side, exactly as in the sheet.
const SEPARATOR = ' · ';
const SHARE_PATTERN = /^(\S+) · (Paid|Not paid)$/;

/** Formats a cell for the sheet: "$12.34 · Paid", "$12.34 · Not paid" or "Not involved". */
export function formatPersonCell(cell: PersonCell): string {
  if (cell.kind === 'notInvolved') {
    return NOT_INVOLVED_TEXT;
  }
  return `${formatDollars(cell.amount)}${SEPARATOR}${cell.status}`;
}

/**
 * Parses a person cell read from the sheet. Strict and case-sensitive: anything else
 * (including a blank cell) is reported, never guessed, because it means a bad hand edit.
 */
export function parsePersonCell(text: string): Result<PersonCell> {
  if (text === NOT_INVOLVED_TEXT) {
    return ok({ kind: 'notInvolved' });
  }
  if (text === '') {
    return fail('The cell is blank. It should be an amount with a status, or "Not involved".');
  }

  const match = SHARE_PATTERN.exec(text);
  const amount = match ? parseDollars(match[1] ?? '') : null;
  const status = match?.[2];
  if (amount === null || (status !== 'Paid' && status !== 'Not paid')) {
    return fail(`"${text}" isn't a valid cell. Expected e.g. "$12.34 · Paid" or "Not involved".`);
  }
  if (amount === 0) {
    return fail(`"${text}" has a $0.00 share. Use "Not involved" instead.`);
  }
  return ok({ kind: 'share', amount, status });
}
