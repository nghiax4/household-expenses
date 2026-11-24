import type { Expense } from './expense';
import { formatDollars } from './money';

/**
 * Text as search compares it: lower case, Vietnamese accents removed ("Tiền điện" → "tien
 * dien"), so typing on a phone without switching keyboards still finds it.
 */
export function foldForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Whether an expense matches what's typed in the search box, like Ctrl+F: the typed text appears
 * somewhere in its description, note, tags, the payer's or a participant's name, or its total
 * ("40" finds $40.00). Case and accents are ignored. Empty text matches everything.
 */
export function matchesSearch(expense: Expense, query: string): boolean {
  const wanted = foldForSearch(query.trim());
  if (wanted === '') {
    return true;
  }
  const sharers = Object.entries(expense.people).flatMap(([person, cell]) =>
    cell.kind === 'share' ? [person] : [],
  );
  // One field per line, so a match can't run from the end of one field into the next.
  const searchable = [
    expense.description,
    expense.note,
    ...expense.tags,
    expense.payer,
    ...sharers,
    formatDollars(expense.total),
    (expense.total / 100).toFixed(2),
  ].join('\n');
  return foldForSearch(searchable).includes(wanted);
}
