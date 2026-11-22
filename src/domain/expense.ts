import type { Cents, PersonName } from './money';
import type { PersonCell, ShareStatus } from './personCell';
import { fail, ok, type Result } from './result';
import { checkCustomSplit } from './split';

/** One row of the Expenses tab. */
export interface Expense {
  /** Sequential and never reused, so "expenses up to #N" is a fixed set. */
  id: number;
  /** Calendar date, "YYYY-MM-DD". */
  date: string;
  description: string;
  total: Cents;
  payer: PersonName;
  note: string;
  /** When it was deleted, or null if it's live. Deleted rows stay in the sheet, hidden. */
  deletedAt: string | null;
  /**
   * Every person's cell. A plain object so it travels as JSON; for person-column order,
   * go through the household's people list rather than this object's keys.
   */
  people: Readonly<Record<PersonName, PersonCell>>;
}

/**
 * An expense as the add form sends it: no ID (the backend assigns it) and no statuses
 * (they follow from who paid).
 */
export interface NewExpense {
  date: string;
  description: string;
  total: Cents;
  payer: PersonName;
  note: string;
  /** Each participant's share. Everyone left out is Not involved. */
  shares: Readonly<Record<PersonName, Cents>>;
}

/** True for a real calendar date written "YYYY-MM-DD" (so "2026-02-30" is false). */
export function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }
  const date = new Date(`${text}T00:00:00Z`);
  // An impossible day either fails to parse or rolls over into the next month.
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

/**
 * Checks a new expense and builds the stored expense with ID `id`. The payer's own share is
 * Paid; everyone else's starts Not paid. The app uses it to explain problems before sending,
 * and the backend uses it again because it never trusts what it receives.
 */
export function buildExpense(
  input: NewExpense,
  id: number,
  people: readonly PersonName[],
): Result<Expense> {
  const description = input.description.trim();
  if (description === '') {
    return fail('Add a description.');
  }
  if (!Number.isSafeInteger(input.total) || input.total <= 0) {
    return fail('The total must be more than $0.00.');
  }
  if (!isCalendarDate(input.date)) {
    return fail('Pick a date.');
  }
  if (!people.includes(input.payer)) {
    return fail('Pick who paid.');
  }

  const shares = new Map(Object.entries(input.shares));
  const stranger = [...shares.keys()].find((person) => !people.includes(person));
  if (stranger !== undefined) {
    return fail(`"${stranger}" isn't one of the household's people.`);
  }
  if ([...shares.values()].some((amount) => !Number.isSafeInteger(amount))) {
    return fail('Every share must be a whole number of cents.');
  }
  const checked = checkCustomSplit(input.total, shares);
  if (!checked.ok) {
    return fail(checked.error);
  }

  const cells = people.map((person): [PersonName, PersonCell] => {
    const amount = shares.get(person);
    return [
      person,
      amount === undefined
        ? { kind: 'notInvolved' }
        : { kind: 'share', amount, status: person === input.payer ? 'Paid' : 'Not paid' },
    ];
  });
  return ok({
    id,
    date: input.date,
    description,
    total: input.total,
    payer: input.payer,
    note: input.note.trim(),
    deletedAt: null,
    people: Object.fromEntries(cells),
  });
}

/**
 * The expense with `person`'s share marked `status`, e.g. when they pay it back. The backend
 * applies it, and the app's test backend uses the same rules.
 */
export function withShareStatus(
  expense: Expense,
  person: PersonName,
  status: ShareStatus,
): Result<Expense> {
  if (expense.deletedAt !== null) {
    return fail(`"${expense.description}" was deleted.`);
  }
  const cell = expense.people[person];
  if (cell?.kind !== 'share') {
    return fail(`${person} isn't part of "${expense.description}".`);
  }
  if (person === expense.payer) {
    return fail(`${person} paid for "${expense.description}", so their share is always Paid.`);
  }
  return ok({ ...expense, people: { ...expense.people, [person]: { ...cell, status } } });
}

/** `withShareStatus` for several people at once: all of them, or none if any is refused. */
export function withShareStatuses(
  expense: Expense,
  statuses: Readonly<Record<PersonName, ShareStatus>>,
): Result<Expense> {
  let result = expense;
  for (const [person, status] of Object.entries(statuses)) {
    const next = withShareStatus(result, person, status);
    if (!next.ok) {
      return next;
    }
    result = next.value;
  }
  return ok(result);
}

/**
 * After an edit, keeps who had already paid back: each person who was sharing (and wasn't the
 * payer) keeps their Paid or Not paid; anyone new starts Not paid; the payer is always Paid. So a
 * payer who stops being the payer but stays in the split now owes their share.
 */
export function carryOverStatuses(before: Expense, after: Expense): Expense {
  const people = Object.fromEntries(
    Object.entries(after.people).map(([person, cell]): [PersonName, PersonCell] => {
      if (cell.kind !== 'share' || person === after.payer) {
        return [person, cell];
      }
      const old = before.people[person];
      const status = old?.kind === 'share' && person !== before.payer ? old.status : 'Not paid';
      return [person, { ...cell, status }];
    }),
  );
  return { ...after, people };
}

/** Live expenses (deleted ones left out), latest date first; same-day expenses newest-added first. */
export function liveExpensesNewestFirst(expenses: readonly Expense[]): Expense[] {
  return expenses
    .filter((expense) => expense.deletedAt === null)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

/**
 * The most recently added descriptions, for the add form's tap-to-fill chips. Each appears
 * once (ignoring case), spelled as it was most recently.
 */
export function recentDescriptions(expenses: readonly Expense[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const newestAddedFirst = expenses
    .filter((expense) => expense.deletedAt === null)
    .sort((a, b) => b.id - a.id);
  for (const { description } of newestAddedFirst) {
    const key = description.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(description);
    }
  }
  return result.slice(0, limit);
}
