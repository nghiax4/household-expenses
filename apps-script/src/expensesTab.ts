// Reading and writing rows of the Expenses tab. Pure: it works on cells as the sheet displays
// them, so the rules are unit-tested without Google services.
import type { SheetData } from '../../src/api/protocol';
import { isCalendarDate, type Expense } from '../../src/domain/expense';
import {
  formatDollars,
  parseDollars,
  sum,
  type Cents,
  type PersonName,
} from '../../src/domain/money';
import {
  formatPersonCell,
  parsePersonCell,
  type PersonCell,
  type ShareStatus,
} from '../../src/domain/personCell';
import { fail, ok, type Result } from '../../src/domain/result';
import { dollarsCell, literal, type SheetCell } from './cells';
import { TAB_HEADERS } from './schema';

const FIXED_HEADERS: readonly string[] = TAB_HEADERS.Expenses;

/** What the Expenses tab alone gives. */
export type ExpensesTab = Pick<SheetData, 'people' | 'expenses' | 'problems'>;

/** Reads the Expenses tab from its displayed cells, header row first. */
export function readExpensesTab(rows: readonly (readonly string[])[]): Result<ExpensesTab> {
  const [header = [], ...dataRows] = rows;
  const people = readPeople(header);
  if (!people.ok) {
    return fail(people.error);
  }

  const expenses: Expense[] = [];
  const problems: string[] = [];
  const seenIds = new Set<number>();
  dataRows.forEach((row, index) => {
    if (row.every((cell) => cell === '')) {
      return;
    }
    const rowNumber = index + 2;
    const expense = readExpenseRow(row, people.value);
    if (!expense.ok) {
      problems.push(`Row ${rowNumber}: ${expense.error}`);
    } else if (seenIds.has(expense.value.id)) {
      problems.push(`Row ${rowNumber}: ID ${expense.value.id} is already used by an earlier row.`);
    } else {
      seenIds.add(expense.value.id);
      expenses.push(expense.value);
    }
  });
  return ok({ people: people.value, expenses, problems });
}

/**
 * The ID for the next expense: one more than the highest ID on any row, including rows with
 * other problems, so fixing those rows later can't create a duplicate.
 */
export function nextExpenseId(rows: readonly (readonly string[])[]): number {
  const ids = rows
    .slice(1)
    .map((row) => row[0] ?? '')
    .filter((cell) => /^[1-9]\d*$/.test(cell))
    .map(Number);
  return Math.max(0, ...ids) + 1;
}

/** The cells to append for a new expense, in column order. */
export function expenseRow(expense: Expense, people: readonly PersonName[]): SheetCell[] {
  return [
    { value: expense.id },
    // Written as a real date so the sheet can sort and filter it, displayed the way it's read.
    { value: expense.date, numberFormat: 'yyyy-mm-dd' },
    literal(expense.description),
    dollarsCell(expense.total),
    literal(expense.payer),
    literal(expense.note),
    literal(expense.deletedAt ?? ''),
    ...people.map((person) => personCell(expense, person)),
  ];
}

/** What to write in `person`'s column of the expense's row. */
export function personCell(expense: Expense, person: PersonName): SheetCell {
  return literal(formatPersonCell(expense.people[person] ?? { kind: 'notInvolved' }));
}

/**
 * Where an expense's row is: its sheet row number (the header is row 1). Refuses when the ID
 * is on several rows, because a hand edit may have copied it and the wrong row could change.
 */
export function expenseRowNumber(rows: readonly (readonly string[])[], id: number): Result<number> {
  const matches = rows.flatMap((row, index) =>
    index > 0 && row[0] === String(id) ? [index + 1] : [],
  );
  const [rowNumber] = matches;
  if (rowNumber === undefined) {
    return fail(`Expense #${id} isn't in the sheet anymore. Reload the list.`);
  }
  if (matches.length > 1) {
    return fail(`Expense #${id} is on rows ${matches.join(' and ')} of the sheet. Fix that first.`);
  }
  return ok(rowNumber);
}

/** The sheet column (A = 1) of a person's cells. */
export function personColumn(people: readonly PersonName[], person: PersonName): number {
  return FIXED_HEADERS.length + people.indexOf(person) + 1;
}

/** The Activity entry for marking a share, e.g. `#2 "Internet": Chi $10.00, Not paid → Paid.` */
export function shareStatusActivity(
  time: string,
  expense: Expense,
  person: PersonName,
  amount: Cents,
  status: ShareStatus,
): SheetCell[] {
  const before: ShareStatus = status === 'Paid' ? 'Not paid' : 'Paid';
  const details =
    `#${expense.id} "${expense.description}": ${person} ${formatDollars(amount)}, ` +
    `${before} → ${status}.`;
  return [
    literal(time),
    literal(status === 'Paid' ? 'Marked paid' : 'Marked not paid'),
    literal(details),
  ];
}

/** The Activity entry for a new expense, e.g. `Added #3 "Groceries" (2026-11-21) $10.00, …`. */
export function addedExpenseActivity(
  time: string,
  expense: Expense,
  people: readonly PersonName[],
): SheetCell[] {
  const shares = people.flatMap((person) => {
    const cell = expense.people[person];
    return cell?.kind === 'share' ? [`${person} ${formatDollars(cell.amount)}`] : [];
  });
  const details = `${summary(expense)} Split: ${shares.join(', ')}.${noteSuffix(expense)}`;
  return [literal(time), literal('Added expense'), literal(details)];
}

/**
 * The Activity entry for a deleted expense, with every person's cell as it was, so the row
 * could be rebuilt by hand from the log alone.
 */
export function deletedExpenseActivity(
  time: string,
  expense: Expense,
  people: readonly PersonName[],
): SheetCell[] {
  const cells = people.flatMap((person) => {
    const cell = expense.people[person];
    return cell?.kind === 'share' ? [`${person} ${formatPersonCell(cell)}`] : [];
  });
  const details = `${summary(expense)} ${cells.join(', ')}.${noteSuffix(expense)}`;
  return [literal(time), literal('Deleted expense'), literal(details)];
}

/**
 * What an edit changed, one item per field or person, e.g. `Total $40.00 → $42.00` or
 * `Chi $10.00 · Not paid → Not involved`. Empty when nothing changed.
 */
export function expenseChanges(
  before: Expense,
  after: Expense,
  people: readonly PersonName[],
): string[] {
  const fields: [string, string, string][] = [
    ['Description', `"${before.description}"`, `"${after.description}"`],
    ['Date', before.date, after.date],
    ['Total', formatDollars(before.total), formatDollars(after.total)],
    ['Payer', before.payer, after.payer],
    ['Note', `"${before.note}"`, `"${after.note}"`],
    ...people.map((person): [string, string, string] => [
      person,
      formatPersonCell(before.people[person] ?? { kind: 'notInvolved' }),
      formatPersonCell(after.people[person] ?? { kind: 'notInvolved' }),
    ]),
  ];
  return fields.flatMap(([name, was, now]) => (was === now ? [] : [`${name} ${was} → ${now}`]));
}

/** The Activity entry for an edit, e.g. `#2 "Internet": Total $40.00 → $42.00; ...`. */
export function editedExpenseActivity(
  time: string,
  before: Expense,
  changes: readonly string[],
): SheetCell[] {
  const details = `#${before.id} "${before.description}": ${changes.join('; ')}.`;
  return [literal(time), literal('Edited expense'), literal(details)];
}

/** `#3 "Groceries" (2026-11-21) $10.00, paid by Bảo.` */
function summary(expense: Expense): string {
  return (
    `#${expense.id} "${expense.description}" (${expense.date}) ${formatDollars(expense.total)}, ` +
    `paid by ${expense.payer}.`
  );
}

function noteSuffix(expense: Expense): string {
  return expense.note === '' ? '' : ` Note: "${expense.note}"`;
}

function readPeople(header: readonly string[]): Result<PersonName[]> {
  if (!FIXED_HEADERS.every((name, i) => header[i] === name)) {
    return fail(
      `The Expenses tab's header row has changed. Columns A to G must be: ` +
        `${FIXED_HEADERS.join(', ')}.`,
    );
  }
  const people = header.slice(FIXED_HEADERS.length);
  while (people.at(-1) === '') {
    people.pop();
  }
  if (people.length === 0) {
    return fail('The Expenses tab has no person columns.');
  }
  if (people.includes('')) {
    return fail('The Expenses tab has a person column with no name in its header.');
  }
  const duplicate = people.find((name, i) => people.indexOf(name) !== i);
  if (duplicate !== undefined) {
    return fail(`"${duplicate}" has two columns in the Expenses tab.`);
  }
  return ok(people);
}

function readExpenseRow(row: readonly string[], people: readonly PersonName[]): Result<Expense> {
  const [
    idText = '',
    date = '',
    description = '',
    totalText = '',
    payer = '',
    note = '',
    deletedAt = '',
  ] = row;

  if (!/^[1-9]\d*$/.test(idText)) {
    return fail(`the ID "${idText}" isn't a whole number above 0.`);
  }
  if (!isCalendarDate(date)) {
    return fail(`the date "${date}" isn't a date written like 2026-11-21.`);
  }
  if (description === '') {
    return fail('the description is empty.');
  }
  const total = parseDollars(totalText);
  if (total === null || total === 0) {
    return fail(`the total "${totalText}" isn't an amount like $12.34 above $0.00.`);
  }
  if (!people.includes(payer)) {
    return fail(`the payer "${payer}" doesn't match any person column.`);
  }

  const cells: [PersonName, PersonCell][] = [];
  for (const [i, person] of people.entries()) {
    const cell = parsePersonCell(row[FIXED_HEADERS.length + i] ?? '');
    if (!cell.ok) {
      return fail(`${person}'s cell: ${cell.error}`);
    }
    cells.push([person, cell.value]);
  }
  const sharesSum = sum(cells.map(([, cell]) => (cell.kind === 'share' ? cell.amount : 0)));
  if (sharesSum !== total) {
    return fail(
      `the shares add up to ${formatDollars(sharesSum)}, but the total is ${formatDollars(total)}.`,
    );
  }

  return ok({
    id: Number(idText),
    date,
    description,
    total,
    payer,
    note,
    deletedAt: deletedAt === '' ? null : deletedAt,
    people: Object.fromEntries(cells),
  });
}
