// Reading and writing rows of the Expenses tab. Pure: it works on cells as the sheet displays
// them, so the rules are unit-tested without Google services.
import type { ExpensesData } from '../../src/api/protocol';
import { isCalendarDate, type Expense } from '../../src/domain/expense';
import { formatDollars, parseDollars, sum, type PersonName } from '../../src/domain/money';
import { formatPersonCell, parsePersonCell, type PersonCell } from '../../src/domain/personCell';
import { fail, ok, type Result } from '../../src/domain/result';
import { TAB_HEADERS } from './schema';

/** One cell to write, with an optional sheet number format such as "yyyy-mm-dd". */
export interface SheetCell {
  value: string | number;
  numberFormat?: string;
}

const FIXED_HEADERS: readonly string[] = TAB_HEADERS.Expenses;

/** Reads the Expenses tab from its displayed cells, header row first. */
export function readExpensesTab(rows: readonly (readonly string[])[]): Result<ExpensesData> {
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
    { value: expense.total / 100, numberFormat: '$#,##0.00' },
    literal(expense.payer),
    literal(expense.note),
    literal(expense.deletedAt ?? ''),
    ...people.map((person) =>
      literal(formatPersonCell(expense.people[person] ?? { kind: 'notInvolved' })),
    ),
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
  const details =
    `#${expense.id} "${expense.description}" (${expense.date}) ${formatDollars(expense.total)}, ` +
    `paid by ${expense.payer}. Split: ${shares.join(', ')}.` +
    (expense.note === '' ? '' : ` Note: "${expense.note}"`);
  return [literal(time), literal('Added expense'), literal(details)];
}

/**
 * Text the sheet stores exactly as given. The leading apostrophe is hidden by Sheets and stops
 * it from turning "1/2" into a date or "=..." into a formula.
 */
function literal(text: string): SheetCell {
  return { value: text === '' ? '' : `'${text}` };
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
